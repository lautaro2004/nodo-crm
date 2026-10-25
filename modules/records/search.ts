import { prisma } from "@/lib/prisma";
import { formatCustomValue } from "@/lib/custom-fields";
import { moduleIdFromEntityType } from "@/lib/custom-modules";

export interface RecordOption {
  id: string;
  label: string;
  /** Línea secundaria (email, código, empresa…). */
  sub?: string | null;
  price?: number | null;
  priceText?: string | null;
  imageFieldId?: string | null;
  imagePath?: string | null;
}

// Búsqueda para los selectores de relación / productos. Scopeada por
// negocio y por entidad; tope de 20 resultados.
// `scope`: alcance de permisos (fragmento where de scopeWhere).
export async function searchRecords(businessId: string, entityType: string, q: string, ids?: string[], scope: Record<string, unknown> = {}): Promise<RecordOption[]> {
  const take = 20;
  const text = q.trim();
  const byIds = { ...(ids?.length ? { id: { in: ids } } : {}), ...(Object.keys(scope).length ? { AND: [scope] } : {}) };
  if (entityType === "contact") {
    const rows = await prisma.contact.findMany({
      where: { businessId, ...byIds, ...(text ? { OR: [{ name: { contains: text, mode: "insensitive" } }, { email: { contains: text, mode: "insensitive" } }] } : {}) },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take,
    });
    return rows.map((r) => ({ id: r.id, label: r.name, sub: r.email }));
  }
  if (entityType === "company") {
    const rows = await prisma.company.findMany({
      where: { businessId, ...byIds, ...(text ? { name: { contains: text, mode: "insensitive" } } : {}) },
      select: { id: true, name: true, domain: true },
      orderBy: { name: "asc" },
      take,
    });
    return rows.map((r) => ({ id: r.id, label: r.name, sub: r.domain }));
  }
  if (entityType === "lead") {
    const rows = await prisma.lead.findMany({
      where: { businessId, ...byIds, ...(text ? { name: { contains: text, mode: "insensitive" } } : {}) },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take,
    });
    return rows.map((r) => ({ id: r.id, label: r.name, sub: r.email }));
  }
  if (entityType === "task") {
    const rows = await prisma.task.findMany({
      where: { businessId, ...byIds, ...(text ? { title: { contains: text, mode: "insensitive" } } : {}) },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take,
    });
    return rows.map((r) => ({ id: r.id, label: r.title, sub: null }));
  }
  if (entityType === "opportunity") {
    const rows = await prisma.opportunity.findMany({
      where: { businessId, ...byIds, ...(text ? { title: { contains: text, mode: "insensitive" } } : {}) },
      select: { id: true, title: true, stage: { select: { label: true } } },
      orderBy: { updatedAt: "desc" },
      take,
    });
    return rows.map((r) => ({ id: r.id, label: r.title, sub: r.stage.label }));
  }
  const moduleId = moduleIdFromEntityType(entityType);
  if (!moduleId) return [];
  const mod = await prisma.customModule.findFirst({ where: { id: moduleId, businessId } });
  if (!mod) return [];
  const rows = await prisma.customRecord.findMany({
    where: { businessId, moduleId, ...byIds, ...(ids?.length ? {} : { archivedAt: null }), ...(text ? { title: { contains: text, mode: "insensitive" } } : {}) },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take,
  });
  const roleIds = [mod.priceFieldId, mod.codeFieldId, mod.imageFieldId].filter((x): x is string => !!x);
  const values = roleIds.length
    ? await prisma.customFieldValue.findMany({
        where: { definitionId: { in: roleIds }, entityId: { in: rows.map((r) => r.id) }, definition: { businessId } },
        select: { definitionId: true, entityId: true, value: true },
      })
    : [];
  const val = (entityId: string, defId: string | null) => (defId ? values.find((v) => v.entityId === entityId && v.definitionId === defId)?.value ?? null : null);
  return rows.map((r) => {
    const priceRaw = val(r.id, mod.priceFieldId);
    const price = priceRaw !== null && !Number.isNaN(Number(priceRaw)) ? Number(priceRaw) : null;
    return {
      id: r.id,
      label: r.title,
      sub: val(r.id, mod.codeFieldId),
      price,
      priceText: priceRaw ? formatCustomValue("currency", priceRaw) : null,
      imageFieldId: mod.imageFieldId,
      imagePath: val(r.id, mod.imageFieldId),
    };
  });
}
