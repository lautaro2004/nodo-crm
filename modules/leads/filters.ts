import type { Prisma } from "@prisma/client";

import { endOfDay, getCustomFieldFilters, getDay, getInt, getList, getParam, type SearchParamsLike } from "@/lib/filters/params";
import { listEntityIdsForTag } from "@/modules/tags/service";
import { entityIdsMatchingCustomFilter } from "@/modules/custom-fields/service";
import { getClosedLeadStatusKeys } from "@/modules/status-definitions/service";

// Filtros de Leads — una sola definición para la lista, el Kanban, las
// vistas guardadas, la exportación CSV y los informes.
export interface LeadFilters {
  search?: string;
  status?: string | string[];
  /** userId, o "none" para los que no tienen responsable. */
  ownerId?: string;
  source?: string[];
  from?: Date;
  to?: Date;
  /** Campo al que aplican from/to. */
  dateField?: "created" | "updated" | "followup";
  /** Solo abiertos: excluye convertidos y estados de rechazo. */
  openOnly?: boolean;
  /** Sin seguimiento real hace N días (0 = nunca tuvo seguimiento). */
  noFollowUpDays?: number;
  tagId?: string;
  customFields?: { definitionId: string; value: string }[];
  sort?: string;
  /** Alcance de permisos (registros visibles para el usuario). Ver scopeWhere. */
  scope?: Prisma.LeadWhereInput;
}

export function parseLeadFilters(sp: SearchParamsLike, currentUserId?: string): LeadFilters {
  const owner = getParam(sp, "ownerId");
  const dateField = getParam(sp, "dateField");
  return {
    search: getParam(sp, "q")?.trim() || undefined,
    status: getList(sp, "status"),
    ownerId: owner === "me" ? currentUserId : owner || undefined,
    source: getList(sp, "source"),
    from: getDay(sp, "from"),
    to: getDay(sp, "to"),
    dateField: dateField === "updated" || dateField === "followup" ? dateField : "created",
    openOnly: getParam(sp, "open") === "1",
    noFollowUpDays: getInt(sp, "nofollowup", 0, 365),
    tagId: getParam(sp, "tagId") || undefined,
    customFields: getCustomFieldFilters(sp),
    sort: getParam(sp, "sort") || undefined,
  };
}

const DATE_FIELD = { created: "createdAt", updated: "updatedAt", followup: "lastFollowUpAt" } as const;

export async function buildLeadWhere(businessId: string, f: LeadFilters, now: Date = new Date()): Promise<Prisma.LeadWhereInput> {
  const and: Prisma.LeadWhereInput[] = [];
  const statuses = typeof f.status === "string" ? [f.status] : f.status;

  if (f.scope && Object.keys(f.scope).length) and.push(f.scope);
  if (statuses?.length) and.push({ status: { in: statuses } });
  if (f.ownerId) and.push({ ownerId: f.ownerId === "none" ? null : f.ownerId });
  if (f.source?.length) and.push({ source: { in: f.source } });
  if (f.search) {
    and.push({
      OR: [
        { name: { contains: f.search, mode: "insensitive" } },
        { email: { contains: f.search, mode: "insensitive" } },
        { phone: { contains: f.search } },
      ],
    });
  }
  if (f.from || f.to) {
    const field = DATE_FIELD[f.dateField ?? "created"];
    and.push({ [field]: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: endOfDay(f.to) } : {}) } });
  }
  if (f.openOnly) {
    and.push({ status: { notIn: await getClosedLeadStatusKeys(businessId) } });
  }
  if (f.noFollowUpDays !== undefined) {
    if (f.noFollowUpDays === 0) {
      and.push({ lastFollowUpAt: null });
    } else {
      // Referencia = último seguimiento o, si nunca hubo, la creación: un
      // lead que entró hace una hora no está "sin seguimiento hace 3 días".
      const cut = new Date(now.getTime() - f.noFollowUpDays * 86_400_000);
      and.push({ OR: [{ lastFollowUpAt: null, createdAt: { lt: cut } }, { lastFollowUpAt: { lt: cut } }] });
    }
  }
  if (f.tagId) {
    and.push({ id: { in: await listEntityIdsForTag(businessId, f.tagId, "lead") } });
  }
  for (const cf of f.customFields ?? []) {
    // Valida negocio + módulo y tolera formatos equivalentes ("sí"/"true",
    // fechas dd/mm o ISO) — ver entityIdsMatchingCustomFilter.
    and.push({ id: { in: await entityIdsMatchingCustomFilter(businessId, "lead", cf.definitionId, cf.value) } });
  }

  return { businessId, ...(and.length ? { AND: and } : {}) };
}

export const LEAD_ORDER = {
  recent: { createdAt: "desc" },
  updated: { updatedAt: "desc" },
  name: { name: "asc" },
  followup: { lastFollowUpAt: { sort: "asc", nulls: "first" } },
} as const satisfies Record<string, Prisma.LeadOrderByWithRelationInput>;

export function leadOrderBy(sort?: string): Prisma.LeadOrderByWithRelationInput {
  return LEAD_ORDER[(sort ?? "recent") as keyof typeof LEAD_ORDER] ?? LEAD_ORDER.recent;
}
