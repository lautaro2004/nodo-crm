import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";
import { assertOptionalOwner } from "@/modules/business/members";
import { assertValidStatus, resolveStatusRules, validateStatusReason } from "@/modules/status-definitions/service";
import { runLeadCreatedAutomations, runLeadStatusAutomations } from "@/modules/automations/engine";
import { buildLeadWhere, leadOrderBy, type LeadFilters } from "@/modules/leads/filters";
import { cleanupDeletedRecord } from "@/modules/records/cleanup";

// crm.Lead — prospecto propio de CADA NEGOCIO que usa el CRM. NO es
// public.Lead (pipeline comercial de Kodexa) — ver
// docs/architecture/crm-fase1-diseno.md y crm-fase2-bootstrap.md. Este
// módulo nunca toca public.Lead.
//
// El modelo asocia Lead <-> Company, pero NO tiene contactId propio (un
// Lead es, por diseño, "todavía no es un Contact real" — el flujo típico
// de CRM es Lead -> se califica -> se convierte en Contact/Opportunity).
// Agregar una relación directa Lead->Contact queda pospuesto hasta que
// exista un flujo real de conversión que la necesite — no se agrega el
// campo sin un caso de uso concreto (ver crm-fase3-core.md, "Decisiones
// tomadas").

export interface CreateLeadInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  status?: string;
  statusReason?: string | null;
  source?: string;
}
export type UpdateLeadInput = Partial<CreateLeadInput>;

async function assertCompanyBelongs(businessId: string, companyId: string | null | undefined) {
  if (!companyId) return;
  const company = await prisma.company.findFirst({ where: { id: companyId, businessId }, select: { id: true } });
  if (!company) throw new Error("company_not_found");
}

export async function createLead(businessId: string, data: CreateLeadInput) {
  await assertCompanyBelongs(businessId, data.companyId);
  await assertOptionalOwner(businessId, data.ownerId);
  if (data.status === "converted") throw new Error("use_convert_endpoint");
  let statusReason: string | null = null;
  if (data.status) statusReason = validateStatusReason(await resolveStatusRules(businessId, "lead", data.status), data.statusReason);
  else await assertValidStatus(businessId, "lead", data.status);
  const lead = await prisma.lead.create({
    data: {
      businessId,
      name: data.name,
      email: data.email || null,
      phone: data.phone ?? null,
      companyId: data.companyId ?? null,
      ownerId: data.ownerId ?? null,
      status: data.status ?? "new",
      statusReason,
      source: data.source ?? "manual",
    },
  });
  await createActivity(businessId, { relatedType: "lead", relatedId: lead.id, type: "note", body: "Lead creado" });
  // Asignación automática (solo si quedó sin responsable). Nunca rompe la
  // creación: el motor registra su propio resultado/error.
  await runLeadCreatedAutomations(businessId, lead.id);
  return lead;
}

// Filtros: ver modules/leads/filters.ts (misma definición para lista,
// Kanban, vistas guardadas, exportación e informes).
export type ListLeadsFilters = LeadFilters;

export async function listLeads(businessId: string, filters: ListLeadsFilters = {}) {
  return prisma.lead.findMany({
    where: await buildLeadWhere(businessId, filters),
    include: { company: { select: { id: true, name: true } } },
    orderBy: leadOrderBy(filters.sort),
  });
}

const TASKS_INCLUDE = { orderBy: { dueAt: "asc" as const }, select: { id: true, title: true, status: true, priority: true, dueAt: true } };

export async function getLead(businessId: string, id: string) {
  return prisma.lead.findFirst({
    where: { id, businessId },
    include: {
      company: { select: { id: true, name: true } },
      tasks: TASKS_INCLUDE,
      convertedContact: { select: { id: true, name: true } },
      convertedOpportunity: { select: { id: true, title: true } },
    },
  });
}

// "converted" es un estado terminal que SOLO puede setear la transacción
// de modules/leads/conversion.ts (que escribe convertedAt/
// convertedContactId/convertedOpportunityId a la vez) — nunca este método
// de edición general. Sin esta guarda, alguien podría elegir "Convertido"
// en el <select> de estado del Lead sin que exista ningún Contact/
// Opportunity real detrás, rompiendo el invariante "convertedAt implica
// convertedContactId" que el resto de la UI asume. Ver
// docs/architecture/crm-fase5-lead-conversion.md, "Estado del Lead".
export async function updateLead(businessId: string, id: string, data: UpdateLeadInput, actorUserId?: string | null) {
  await assertCompanyBelongs(businessId, data.companyId);
  const current = await prisma.lead.findFirst({ where: { id, businessId } });
  if (!current) return null;

  if (data.status === "converted") throw new Error("use_convert_endpoint");
  if (current.status === "converted" && data.status && data.status !== current.status) {
    throw new Error("lead_already_converted");
  }
  await assertOptionalOwner(businessId, data.ownerId);

  // Regla de transición validada en el servidor (aplica igual desde el
  // detalle, el Kanban o la API): un estado con motivo obligatorio exige
  // `statusReason` válido; al salir de él, el motivo se limpia.
  const statusChanged = !!data.status && data.status !== current.status;
  const { statusReason: requestedReason, ...rest } = data;
  let statusReason: string | null | undefined;
  let rules: Awaited<ReturnType<typeof resolveStatusRules>> | null = null;
  if (statusChanged) {
    rules = await resolveStatusRules(businessId, "lead", data.status!);
    statusReason = validateStatusReason(rules, requestedReason);
  } else if (requestedReason !== undefined) {
    // Editar el motivo sin cambiar de estado: mismas reglas del estado actual.
    statusReason = validateStatusReason(await resolveStatusRules(businessId, "lead", current.status), requestedReason);
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { ...rest, ...(statusReason !== undefined ? { statusReason } : {}) },
  });

  if (statusChanged) {
    const activity = await createActivity(businessId, {
      relatedType: "lead",
      relatedId: id,
      type: "status_change",
      body: `${current.status} → ${data.status}${statusReason ? ` · Motivo: ${statusReason}` : ""}`,
      ownerId: actorUserId ?? null,
    });
    await runLeadStatusAutomations(businessId, { leadId: id, from: current.status, to: data.status!, eventId: activity?.id ?? `${Date.now()}` });
  }

  return updated;
}

export async function deleteLead(businessId: string, id: string) {
  const result = await prisma.lead.deleteMany({ where: { id, businessId } });
  if (result.count > 0) await cleanupDeletedRecord(businessId, "lead", id);
  return result.count > 0;
}
