import { prisma } from "@/lib/prisma";
import { listEntityIdsForTag } from "@/modules/tags/service";

// Todo módulo de dominio del CRM recibe businessId como PRIMER argumento y
// lo aplica en cada where — nunca se confía en un id sin scopear (ver
// docs/architecture/crm-fase3-core.md, "Modelo multi-tenant").

export interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  phone?: string | null;
  status?: string;
  ownerId?: string | null;
}
export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export async function createCompany(businessId: string, data: CreateCompanyInput) {
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
}

export async function listCompanies(businessId: string, filters: ListCompaniesFilters = {}) {
  // Filtro por tag: resuelve los entityId etiquetados PRIMERO (scopeado a
  // businessId dentro de listEntityIdsForTag) y filtra por id — evita que
  // un tagId de otro Workspace devuelva resultados de este.
  const taggedIds = filters.tagId ? await listEntityIdsForTag(businessId, filters.tagId, "company") : undefined;

  return prisma.company.findMany({
    where: {
      businessId,
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
export async function getCompany(businessId: string, id: string) {
  return prisma.company.findFirst({
    where: { id, businessId },
    include: { contacts: true, leads: true, opportunities: true },
  });
}

export async function updateCompany(businessId: string, id: string, data: UpdateCompanyInput) {
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

export async function deleteCompany(businessId: string, id: string) {
  const result = await prisma.company.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
