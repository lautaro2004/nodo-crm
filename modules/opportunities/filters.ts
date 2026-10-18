import type { Prisma } from "@prisma/client";

import { endOfDay, getCustomFieldFilters, getDay, getInt, getList, getParam, type SearchParamsLike } from "@/lib/filters/params";
import { listEntityIdsForTag } from "@/modules/tags/service";
import { entityIdsMatchingCustomFilter } from "@/modules/custom-fields/service";

// Una oportunidad abierta sin ningún cambio en este lapso se considera
// "estancada" (dashboard, vista guardada, aviso en la tarjeta del Kanban).
export const STALLED_DAYS = 14;

// Filtros de Oportunidades — misma definición para lista, Kanban, vistas
// guardadas, exportación e informes.
export interface OpportunityFilters {
  search?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string | string[];
  ownerId?: string;
  from?: Date;
  to?: Date;
  dateField?: "created" | "updated" | "closed";
  /** Solo abiertas sin cambios desde esta fecha (estancadas). */
  stalledBefore?: Date;
  minAmount?: number;
  tagId?: string;
  customFields?: { definitionId: string; value: string }[];
  sort?: string;
}

export function parseOpportunityFilters(sp: SearchParamsLike, currentUserId?: string, now: Date = new Date()): OpportunityFilters {
  const owner = getParam(sp, "ownerId");
  const dateField = getParam(sp, "dateField");
  const stalledDays = getParam(sp, "stalled") === "1" ? STALLED_DAYS : getInt(sp, "stalledDays", 1, 365);
  return {
    search: getParam(sp, "q")?.trim() || undefined,
    pipelineId: getParam(sp, "pipelineId") || undefined,
    stageId: getParam(sp, "stageId") || undefined,
    status: getList(sp, "status"),
    ownerId: owner === "me" ? currentUserId : owner || undefined,
    from: getDay(sp, "from"),
    to: getDay(sp, "to"),
    dateField: dateField === "updated" || dateField === "closed" ? dateField : "created",
    stalledBefore: stalledDays ? new Date(now.getTime() - stalledDays * 86_400_000) : undefined,
    minAmount: getInt(sp, "minAmount", 0, 2_000_000_000),
    tagId: getParam(sp, "tagId") || undefined,
    customFields: getCustomFieldFilters(sp),
    sort: getParam(sp, "sort") || undefined,
  };
}

const DATE_FIELD = { created: "createdAt", updated: "updatedAt", closed: "closedAt" } as const;

export async function buildOpportunityWhere(businessId: string, f: OpportunityFilters): Promise<Prisma.OpportunityWhereInput> {
  const and: Prisma.OpportunityWhereInput[] = [];
  const statuses = typeof f.status === "string" ? [f.status] : f.status;

  if (f.pipelineId) and.push({ pipelineId: f.pipelineId });
  if (f.stageId) and.push({ stageId: f.stageId });
  if (statuses?.length) and.push({ status: { in: statuses } });
  if (f.ownerId) and.push({ ownerId: f.ownerId === "none" ? null : f.ownerId });
  if (f.search) and.push({ title: { contains: f.search, mode: "insensitive" } });
  if (f.from || f.to) {
    const field = DATE_FIELD[f.dateField ?? "created"];
    and.push({ [field]: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: endOfDay(f.to) } : {}) } });
  }
  if (f.stalledBefore) and.push({ status: "open", updatedAt: { lt: f.stalledBefore } });
  if (f.minAmount !== undefined) and.push({ amount: { gte: f.minAmount } });
  if (f.tagId) and.push({ id: { in: await listEntityIdsForTag(businessId, f.tagId, "opportunity") } });
  for (const cf of f.customFields ?? []) {
    // Valida negocio + módulo y tolera formatos equivalentes ("sí"/"true",
    // fechas dd/mm o ISO) — ver entityIdsMatchingCustomFilter.
    and.push({ id: { in: await entityIdsMatchingCustomFilter(businessId, "opportunity", cf.definitionId, cf.value) } });
  }
  return { businessId, ...(and.length ? { AND: and } : {}) };
}

const OPPORTUNITY_ORDER = {
  recent: { createdAt: "desc" },
  updated: { updatedAt: "desc" },
  amount: { amount: { sort: "desc", nulls: "last" } },
  title: { title: "asc" },
} as const satisfies Record<string, Prisma.OpportunityOrderByWithRelationInput>;

export function opportunityOrderBy(sort?: string): Prisma.OpportunityOrderByWithRelationInput {
  return OPPORTUNITY_ORDER[(sort ?? "recent") as keyof typeof OPPORTUNITY_ORDER] ?? OPPORTUNITY_ORDER.recent;
}
