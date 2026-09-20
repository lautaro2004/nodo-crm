import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";

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

async function assertBelongsToBusiness(businessId: string, input: { companyId?: string | null; contactId?: string | null; pipelineId?: string; stageId?: string }) {
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
  if (input.stageId) {
    const s = await prisma.pipelineStage.findFirst({
      where: { id: input.stageId, pipeline: { businessId } },
      select: { id: true },
    });
    if (!s) throw new Error("stage_not_found");
  }
}

export async function createOpportunity(businessId: string, data: CreateOpportunityInput) {
  await assertBelongsToBusiness(businessId, data);
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

export interface ListOpportunitiesFilters {
  search?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string;
  ownerId?: string;
}

export async function listOpportunities(businessId: string, filters: ListOpportunitiesFilters = {}) {
  return prisma.opportunity.findMany({
    where: {
      businessId,
      ...(filters.pipelineId ? { pipelineId: filters.pipelineId } : {}),
      ...(filters.stageId ? { stageId: filters.stageId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      stage: true,
      pipeline: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
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
  const current = await prisma.opportunity.findFirst({ where: { id, businessId } });
  if (!current) return null;

  const closedAt = data.status && data.status !== "open" ? new Date() : data.status === "open" ? null : undefined;

  const updated = await prisma.opportunity.update({
    where: { id },
    data: { ...data, ...(closedAt !== undefined ? { closedAt } : {}) },
  });

  if (data.stageId && data.stageId !== current.stageId) {
    await createActivity(businessId, { relatedType: "opportunity", relatedId: id, type: "stage_change", body: null });
  }
  if (data.status && data.status !== current.status) {
    await createActivity(businessId, {
      relatedType: "opportunity",
      relatedId: id,
      type: "status_change",
      body: `${current.status} → ${data.status}`,
    });
  }

  return updated;
}

export async function deleteOpportunity(businessId: string, id: string) {
  const result = await prisma.opportunity.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
