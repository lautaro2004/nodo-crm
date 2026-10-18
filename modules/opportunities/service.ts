import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";
import { assertOptionalOwner } from "@/modules/business/members";
import { buildOpportunityWhere, opportunityOrderBy, type OpportunityFilters } from "@/modules/opportunities/filters";
import { cleanupDeletedRecord } from "@/modules/records/cleanup";

export interface CreateOpportunityInput {
  title: string;
  companyId?: string | null;
  contactId?: string | null;
  pipelineId: string;
  stageId: string;
  amount?: number | null;
  ownerId?: string | null;
}
export interface UpdateOpportunityInput extends Partial<CreateOpportunityInput> {
  status?: "open" | "won" | "lost";
}

async function assertBelongsToBusiness(businessId: string, input: { companyId?: string | null; contactId?: string | null; pipelineId?: string; ownerId?: string | null }) {
  if (input.companyId) {
    const c = await prisma.company.findFirst({ where: { id: input.companyId, businessId }, select: { id: true } });
    if (!c) throw new Error("company_not_found");
  }
  if (input.contactId) {
    const c = await prisma.contact.findFirst({ where: { id: input.contactId, businessId }, select: { id: true } });
    if (!c) throw new Error("contact_not_found");
  }
  if (input.pipelineId) {
    const p = await prisma.pipeline.findFirst({ where: { id: input.pipelineId, businessId }, select: { id: true } });
    if (!p) throw new Error("pipeline_not_found");
  }
  await assertOptionalOwner(businessId, input.ownerId);
}

// La etapa tiene que pertenecer al negocio (vía pipeline) Y al mismo
// pipeline de la oportunidad — antes solo se chequeaba lo primero, así que
// un PATCH podía dejar una oportunidad del pipeline A "parada" en una
// etapa del pipeline B (desaparece de ambos Kanban).
async function resolveStage(businessId: string, stageId: string, pipelineId: string) {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { businessId } },
    select: { id: true, pipelineId: true, label: true, isWon: true, isLost: true },
  });
  if (!stage) throw new Error("stage_not_found");
  if (stage.pipelineId && stage.pipelineId !== pipelineId) throw new Error("stage_not_in_pipeline");
  return stage;
}

// Status derivado de la etapa: mover a una etapa Ganada/Perdida cierra la
// oportunidad; volver a una etapa normal la reabre. Antes lo calculaba el
// Kanban en el navegador — cualquier otro cliente de la API (o el form de
// edición) podía dejar "Ganado" con status "open".
function statusForStage(stage: { isWon?: boolean; isLost?: boolean }): "open" | "won" | "lost" {
  return stage.isWon ? "won" : stage.isLost ? "lost" : "open";
}

export async function createOpportunity(businessId: string, data: CreateOpportunityInput) {
  await assertBelongsToBusiness(businessId, data);
  const stage = await resolveStage(businessId, data.stageId, data.pipelineId);
  const status = statusForStage(stage);
  const opportunity = await prisma.opportunity.create({
    data: {
      businessId,
      title: data.title,
      companyId: data.companyId ?? null,
      contactId: data.contactId ?? null,
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      amount: data.amount ?? null,
      ownerId: data.ownerId ?? null,
      ...(status !== "open" ? { status, closedAt: new Date() } : {}),
    },
  });
  await createActivity(businessId, {
    relatedType: "opportunity",
    relatedId: opportunity.id,
    type: "note",
    body: "Oportunidad creada",
  });
  return opportunity;
}

// Filtros: ver modules/opportunities/filters.ts.
export type ListOpportunitiesFilters = OpportunityFilters;

export async function listOpportunities(businessId: string, filters: ListOpportunitiesFilters = {}) {
  return prisma.opportunity.findMany({
    where: await buildOpportunityWhere(businessId, filters),
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      stage: true,
      pipeline: { select: { id: true, name: true } },
    },
    orderBy: opportunityOrderBy(filters.sort),
  });
}

const TASKS_INCLUDE = { orderBy: { dueAt: "asc" as const }, select: { id: true, title: true, status: true, priority: true, dueAt: true } };

export async function getOpportunity(businessId: string, id: string) {
  return prisma.opportunity.findFirst({
    where: { id, businessId },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      stage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      tasks: TASKS_INCLUDE,
      // Fase 5 — "Origen: Lead convertido". A lo sumo uno (convertedOpportunityId
      // es @unique del lado del Lead).
      convertedFromLead: { select: { id: true, name: true } },
    },
  });
}

export async function updateOpportunity(businessId: string, id: string, data: UpdateOpportunityInput) {
  await assertBelongsToBusiness(businessId, data);
  const current = await prisma.opportunity.findFirst({ where: { id, businessId }, include: { stage: { select: { label: true } } } });
  if (!current) return null;

  const pipelineId = data.pipelineId ?? current.pipelineId;
  if (data.pipelineId && data.pipelineId !== current.pipelineId && !data.stageId) throw new Error("stage_required");

  const stageChanged = !!data.stageId && data.stageId !== current.stageId;
  const nextStage = data.stageId ? await resolveStage(businessId, data.stageId, pipelineId) : null;

  // Un status explícito en el mismo request gana (ej. "Marcar como
  // perdida" desde el detalle); si solo cambió la etapa, se deriva de ella.
  const nextStatus = data.status ?? (stageChanged && nextStage ? statusForStage(nextStage) : undefined);
  const statusChanged = !!nextStatus && nextStatus !== current.status;
  const closedAt = statusChanged ? (nextStatus === "open" ? null : new Date()) : undefined;

  const updated = await prisma.opportunity.update({
    where: { id },
    data: {
      ...data,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(closedAt !== undefined ? { closedAt } : {}),
    },
  });

  if (stageChanged) {
    const from = current.stage?.label;
    const to = nextStage?.label;
    await createActivity(businessId, {
      relatedType: "opportunity",
      relatedId: id,
      type: "stage_change",
      body: from && to ? `${from} → ${to}` : null,
    });
  }
  if (statusChanged) {
    await createActivity(businessId, {
      relatedType: "opportunity",
      relatedId: id,
      type: "status_change",
      body: `${current.status} → ${nextStatus}`,
    });
  }

  return updated;
}

export async function deleteOpportunity(businessId: string, id: string) {
  const result = await prisma.opportunity.deleteMany({ where: { id, businessId } });
  if (result.count > 0) await cleanupDeletedRecord(businessId, "opportunity", id);
  return result.count > 0;
}
