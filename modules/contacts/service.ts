import { prisma } from "@/lib/prisma";
import { assertOptionalOwner } from "@/modules/business/members";
import { cleanupDeletedRecord } from "@/modules/records/cleanup";
import { prepareCustomValues } from "@/modules/custom-fields/service";
import { proposedFrom, trackChange } from "@/modules/automations/workflow";

export interface CreateContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  /** Campos personalizados (definitionId → valor). Ver prepareCustomValues. */
  customValues?: Record<string, string | null>;
}
export type UpdateContactInput = Partial<CreateContactInput>;

// Si viene companyId, se valida que la Company sea del MISMO businessId
// antes de asociarla — mismo criterio que assignTag/setCustomFieldValue:
// nunca confiar en un id ajeno recibido del cliente.
async function assertCompanyBelongs(businessId: string, companyId: string | null | undefined) {
  if (!companyId) return;
  const company = await prisma.company.findFirst({ where: { id: companyId, businessId }, select: { id: true } });
  if (!company) throw new Error("company_not_found");
}

export async function createContact(businessId: string, input: CreateContactInput, options: { enforceRequired?: boolean; actorUserId?: string | null } = {}) {
  const { customValues, ...data } = input;
  // trackChange: validaciones "antes de guardar" y automatizaciones
  // genéricas (modules/automations/workflow.ts).
  return trackChange(
    { businessId, entityType: "contact", kind: "create", proposed: proposedFrom(data, customValues), actorUserId: options.actorUserId },
    async () => {
      // Valida los campos personalizados ANTES de crear (nunca un registro a medias).
      const writeCustom = await prepareCustomValues(businessId, "contact", customValues ?? {}, { creating: true, enforceRequired: options.enforceRequired });
      const created = await insertContact(businessId, data);
      await writeCustom(created.id);
      return created;
    },
    (created) => created.id
  );
}

async function insertContact(businessId: string, data: Omit<CreateContactInput, "customValues">) {
  await assertCompanyBelongs(businessId, data.companyId);
  await assertOptionalOwner(businessId, data.ownerId);
  return prisma.contact.create({
    data: {
      businessId,
      name: data.name,
      email: data.email || null,
      phone: data.phone ?? null,
      companyId: data.companyId ?? null,
      ownerId: data.ownerId ?? null,
    },
  });
}

export interface ListContactsFilters {
  search?: string;
  companyId?: string;
  /** Alcance de permisos (registros visibles para el usuario). */
  scope?: Record<string, unknown>;
}

export async function listContacts(businessId: string, filters: ListContactsFilters = {}) {
  return prisma.contact.findMany({
    where: {
      businessId,
      ...(filters.scope && Object.keys(filters.scope).length ? { AND: [filters.scope] } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
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

const TASKS_INCLUDE = { orderBy: { dueAt: "asc" as const }, select: { id: true, title: true, status: true, priority: true, dueAt: true } };

export async function getContact(businessId: string, id: string) {
  return prisma.contact.findFirst({
    where: { id, businessId },
    include: {
      company: { select: { id: true, name: true } },
      opportunities: true,
      tasks: TASKS_INCLUDE,
      // Fase 5 — "Origen: Lead convertido". Array porque más de un Lead
      // puede haberse convertido reutilizando este mismo Contact ("usar
      // existente").
      convertedFromLeads: { select: { id: true, name: true } },
    },
  });
}

export async function updateContact(businessId: string, id: string, input: UpdateContactInput, actorUserId: string | null = null) {
  const { customValues, ...data } = input;
  return trackChange(
    { businessId, entityType: "contact", kind: "update", recordId: id, proposed: proposedFrom(data, customValues), actorUserId },
    async () => {
      const writeCustom = customValues ? await prepareCustomValues(businessId, "contact", customValues, { recordId: id }) : null;
      const updated = await applyContactUpdate(businessId, id, data);
      if (updated && writeCustom) await writeCustom(id);
      return updated;
    },
    (updated) => updated?.id
  );
}

async function applyContactUpdate(businessId: string, id: string, data: Omit<UpdateContactInput, "customValues">) {
  await assertCompanyBelongs(businessId, data.companyId);
  await assertOptionalOwner(businessId, data.ownerId);
  const result = await prisma.contact.updateMany({ where: { id, businessId }, data });
  if (result.count === 0) return null;
  return getContact(businessId, id);
}

export async function deleteContact(businessId: string, id: string, actorUserId: string | null = null) {
  return trackChange(
    { businessId, entityType: "contact", kind: "delete", recordId: id, actorUserId },
    async () => {
      const result = await prisma.contact.deleteMany({ where: { id, businessId } });
      if (result.count > 0) await cleanupDeletedRecord(businessId, "contact", id);
      return result.count > 0;
    },
    (ok) => (ok ? id : null)
  );
}
