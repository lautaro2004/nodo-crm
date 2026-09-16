import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";

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
  const lead = await prisma.lead.create({
    data: {
      businessId,
      name: data.name,
      email: data.email || null,
      phone: data.phone ?? null,
      companyId: data.companyId ?? null,
      ownerId: data.ownerId ?? null,
      status: data.status ?? "new",
      source: data.source ?? "manual",
    },
  });
  await createActivity(businessId, { relatedType: "lead", relatedId: lead.id, type: "note", body: "Lead creado" });
  return lead;
}

export interface ListLeadsFilters {
  search?: string;
  status?: string;
  ownerId?: string;
}

export async function listLeads(businessId: string, filters: ListLeadsFilters = {}) {
  return prisma.lead.findMany({
    where: {
      businessId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLead(businessId: string, id: string) {
  return prisma.lead.findFirst({
    where: { id, businessId },
    include: { company: { select: { id: true, name: true } } },
  });
}

export async function updateLead(businessId: string, id: string, data: UpdateLeadInput) {
  await assertCompanyBelongs(businessId, data.companyId);
  const current = await prisma.lead.findFirst({ where: { id, businessId } });
  if (!current) return null;

  const updated = await prisma.lead.update({ where: { id }, data });

  if (data.status && data.status !== current.status) {
    await createActivity(businessId, {
      relatedType: "lead",
      relatedId: id,
      type: "status_change",
      body: `${current.status} → ${data.status}`,
    });
  }

  return updated;
}

export async function deleteLead(businessId: string, id: string) {
  const result = await prisma.lead.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
