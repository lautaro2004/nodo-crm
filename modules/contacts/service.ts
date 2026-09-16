import { prisma } from "@/lib/prisma";

export interface CreateContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
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

export async function createContact(businessId: string, data: CreateContactInput) {
  await assertCompanyBelongs(businessId, data.companyId);
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
}

export async function listContacts(businessId: string, filters: ListContactsFilters = {}) {
  return prisma.contact.findMany({
    where: {
      businessId,
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

export async function getContact(businessId: string, id: string) {
  return prisma.contact.findFirst({
    where: { id, businessId },
    include: { company: { select: { id: true, name: true } }, opportunities: true },
  });
}

export async function updateContact(businessId: string, id: string, data: UpdateContactInput) {
  await assertCompanyBelongs(businessId, data.companyId);
  const result = await prisma.contact.updateMany({ where: { id, businessId }, data });
  if (result.count === 0) return null;
  return getContact(businessId, id);
}

export async function deleteContact(businessId: string, id: string) {
  const result = await prisma.contact.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
