import { prisma } from "@/lib/prisma";
import { listEntityIdsForTag } from "@/modules/tags/service";
import { assertOptionalOwner } from "@/modules/business/members";
import { assertValidStatus } from "@/modules/status-definitions/service";
import { cleanupDeletedRecord } from "@/modules/records/cleanup";
import { prepareCustomValues } from "@/modules/custom-fields/service";
import { proposedFrom, trackChange } from "@/modules/automations/workflow";

// Todo módulo de dominio del CRM recibe businessId como PRIMER argumento y
// lo aplica en cada where — nunca se confía en un id sin scopear (ver
// docs/architecture/crm-fase3-core.md, "Modelo multi-tenant").

export interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  phone?: string | null;
  status?: string;
  ownerId?: string | null;
  /** Campos personalizados (definitionId → valor). Ver prepareCustomValues. */
  customValues?: Record<string, string | null>;
}
export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export async function createCompany(businessId: string, input: CreateCompanyInput, options: { enforceRequired?: boolean; actorUserId?: string | null } = {}) {
  const { customValues, ...data } = input;
  // trackChange: validaciones "antes de guardar" y automatizaciones
  // genéricas (modules/automations/workflow.ts).
  return trackChange(
    { businessId, entityType: "company", kind: "create", proposed: proposedFrom(data, customValues), actorUserId: options.actorUserId },
    async () => {
      // Valida los campos personalizados ANTES de crear (nunca un registro a medias).
      const writeCustom = await prepareCustomValues(businessId, "company", customValues ?? {}, { creating: true, enforceRequired: options.enforceRequired });
      const created = await insertCompany(businessId, data);
      await writeCustom(created.id);
      return created;
    },
    (created) => created.id
  );
}

async function insertCompany(businessId: string, data: Omit<CreateCompanyInput, "customValues">) {
  await assertOptionalOwner(businessId, data.ownerId);
  await assertValidStatus(businessId, "company", data.status);
  return prisma.company.create({
    data: {
      businessId,
      name: data.name,
      domain: data.domain ?? null,
      phone: data.phone ?? null,
      status: data.status ?? "prospect",
      ownerId: data.ownerId ?? null,
    },
  });
}

export interface ListCompaniesFilters {
  search?: string;
  status?: string;
  ownerId?: string;
  tagId?: string;
  /** Alcance de permisos (registros visibles para el usuario). */
  scope?: Record<string, unknown>;
}

export async function listCompanies(businessId: string, filters: ListCompaniesFilters = {}) {
  // Filtro por tag: resuelve los entityId etiquetados PRIMERO (scopeado a
  // businessId dentro de listEntityIdsForTag) y filtra por id — evita que
  // un tagId de otro Workspace devuelva resultados de este.
  const taggedIds = filters.tagId ? await listEntityIdsForTag(businessId, filters.tagId, "company") : undefined;

  return prisma.company.findMany({
    where: {
      businessId,
      ...(filters.scope && Object.keys(filters.scope).length ? { AND: [filters.scope] } : {}),
      ...(taggedIds ? { id: { in: taggedIds } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { domain: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

// getFirst en vez de findUnique(id): el where incluye businessId siempre,
// así que un id real de OTRO negocio nunca matchea — es lo que hace el
// aislamiento real, no solo "el campo existe" (ver Fase 4 de Nexo, mismo
// criterio).
const TASKS_INCLUDE = { orderBy: { dueAt: "asc" as const }, select: { id: true, title: true, status: true, priority: true, dueAt: true } };

export async function getCompany(businessId: string, id: string) {
  return prisma.company.findFirst({
    where: { id, businessId },
    include: { contacts: true, leads: true, opportunities: true, tasks: TASKS_INCLUDE },
  });
}

export async function updateCompany(businessId: string, id: string, input: UpdateCompanyInput, actorUserId: string | null = null) {
  const { customValues, ...data } = input;
  return trackChange(
    { businessId, entityType: "company", kind: "update", recordId: id, proposed: proposedFrom(data, customValues), actorUserId },
    async () => {
      const writeCustom = customValues ? await prepareCustomValues(businessId, "company", customValues, { recordId: id }) : null;
      const updated = await applyCompanyUpdate(businessId, id, data);
      if (updated && writeCustom) await writeCustom(id);
      return updated;
    },
    (updated) => updated?.id
  );
}

async function applyCompanyUpdate(businessId: string, id: string, data: Omit<UpdateCompanyInput, "customValues">) {
  await assertOptionalOwner(businessId, data.ownerId);
  await assertValidStatus(businessId, "company", data.status);
  const result = await prisma.company.updateMany({ where: { id, businessId }, data });
  if (result.count === 0) return null;
  return getCompany(businessId, id);
}

// "Archivar" (status: "archived") es la acción primaria — status ya es
// texto libre configurable (mismo criterio que todo el proyecto), así que
// esto no pide ningún campo nuevo. El modelo NO tiene un flag de
// soft-delete dedicado; en vez de agregar uno sin necesidad concreta
// (contra la indicación explícita del pedido), se reusa `status`. Un
// hard-delete real queda disponible aparte para limpiar registros de
// prueba, no como la acción principal de la UI.
export async function archiveCompany(businessId: string, id: string) {
  const result = await prisma.company.updateMany({ where: { id, businessId }, data: { status: "archived" } });
  return result.count > 0;
}

export async function deleteCompany(businessId: string, id: string, actorUserId: string | null = null) {
  return trackChange(
    { businessId, entityType: "company", kind: "delete", recordId: id, actorUserId },
    async () => {
      const result = await prisma.company.deleteMany({ where: { id, businessId } });
      if (result.count > 0) await cleanupDeletedRecord(businessId, "company", id);
      return result.count > 0;
    },
    (ok) => (ok ? id : null)
  );
}
