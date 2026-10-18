import { prisma } from "@/lib/prisma";
import { moduleIdFromEntityType } from "@/lib/custom-modules";

// Relaciones explícitas entre registros (campos "relation"). Se guardan en
// RecordLink y se consultan desde los dos lados. Nunca se copian registros.

/** De los ids pedidos, cuáles existen en ESTE negocio y en esa entidad. */
export async function existingIds(businessId: string, entityType: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const where = { id: { in: ids }, businessId };
  const select = { id: true } as const;
  let rows: { id: string }[];
  switch (entityType) {
    case "contact":
      rows = await prisma.contact.findMany({ where, select });
      break;
    case "company":
      rows = await prisma.company.findMany({ where, select });
      break;
    case "opportunity":
      rows = await prisma.opportunity.findMany({ where, select });
      break;
    case "lead":
      rows = await prisma.lead.findMany({ where, select });
      break;
    default: {
      const moduleId = moduleIdFromEntityType(entityType);
      rows = moduleId ? await prisma.customRecord.findMany({ where: { ...where, moduleId }, select }) : [];
    }
  }
  return new Set(rows.map((r) => r.id));
}

export function parseIdList(raw: string | null | undefined): string[] {
  return Array.from(new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)));
}

/**
 * Reemplaza los vínculos de un campo relación para un registro origen.
 * Lanza "invalid_relation" si algún destino no existe en el negocio/entidad
 * o si el campo es "a uno" y llegan varios.
 */
export async function setRelationLinks(
  businessId: string,
  definition: { id: string; targetEntity: string | null; multiple: boolean },
  fromType: string,
  fromId: string,
  toIds: string[]
) {
  if (!definition.targetEntity) throw new Error("invalid_relation");
  if (!definition.multiple && toIds.length > 1) throw new Error("invalid_relation");
  const found = await existingIds(businessId, definition.targetEntity, toIds);
  if (found.size !== toIds.length) throw new Error("invalid_relation");

  await prisma.$transaction([
    prisma.recordLink.deleteMany({ where: { businessId, definitionId: definition.id, fromId, toId: { notIn: toIds } } }),
    ...toIds.map((toId) =>
      prisma.recordLink.upsert({
        where: { definitionId_fromId_toId: { definitionId: definition.id, fromId, toId } },
        create: { businessId, definitionId: definition.id, fromType, fromId, toType: definition.targetEntity!, toId },
        update: {},
      })
    ),
  ]);
}

/** Vínculos salientes de un registro: definitionId → [{ id, label }]. */
export async function outgoingLinks(businessId: string, fromId: string) {
  const links = await prisma.recordLink.findMany({ where: { businessId, fromId }, orderBy: { createdAt: "asc" } });
  const labels = await resolveLabels(businessId, links.map((l) => ({ type: l.toType, id: l.toId })));
  const byDef = new Map<string, { id: string; type: string; label: string; href: string }[]>();
  for (const l of links) {
    const info = labels.get(`${l.toType}:${l.toId}`);
    if (!info) continue; // destino borrado: no se muestra
    if (!byDef.has(l.definitionId)) byDef.set(l.definitionId, []);
    byDef.get(l.definitionId)!.push({ id: l.toId, type: l.toType, ...info });
  }
  return byDef;
}

/**
 * Vínculos entrantes ("¿qué apunta a este registro?"), agrupados por el
 * campo relación. Solo de módulos personalizados no archivados del negocio.
 */
export async function incomingLinks(businessId: string, toType: string, toId: string) {
  const links = await prisma.recordLink.findMany({
    where: { businessId, toType, toId },
    include: { definition: { select: { id: true, label: true, moduleId: true, module: { select: { labelPlural: true, archivedAt: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const visible = links.filter((l) => !l.definition.module?.archivedAt);
  const labels = await resolveLabels(businessId, visible.map((l) => ({ type: l.fromType, id: l.fromId })));
  const groups = new Map<string, { title: string; items: { id: string; label: string; href: string }[] }>();
  for (const l of visible) {
    const info = labels.get(`${l.fromType}:${l.fromId}`);
    if (!info) continue;
    const key = l.definition.id;
    const title = l.definition.module ? `${l.definition.module.labelPlural} · ${l.definition.label}` : l.definition.label;
    if (!groups.has(key)) groups.set(key, { title, items: [] });
    groups.get(key)!.items.push({ id: l.fromId, ...info });
  }
  return Array.from(groups.values());
}

const STANDARD_HREF: Record<string, string> = {
  contact: "/dashboard/contactos",
  company: "/dashboard/empresas",
  opportunity: "/dashboard/oportunidades",
  lead: "/dashboard/leads",
};

/** Nombre + link de registros de cualquier entidad (scopeado al negocio). */
export async function resolveLabels(businessId: string, refs: { type: string; id: string }[]) {
  const out = new Map<string, { label: string; href: string }>();
  const byType = new Map<string, string[]>();
  for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  for (const [type, ids] of byType) {
    const where = { id: { in: ids }, businessId };
    if (type === "contact" || type === "company" || type === "lead") {
      const rows =
        type === "contact"
          ? await prisma.contact.findMany({ where, select: { id: true, name: true } })
          : type === "company"
            ? await prisma.company.findMany({ where, select: { id: true, name: true } })
            : await prisma.lead.findMany({ where, select: { id: true, name: true } });
      for (const r of rows) out.set(`${type}:${r.id}`, { label: r.name, href: `${STANDARD_HREF[type]}/${r.id}` });
    } else if (type === "opportunity") {
      const rows = await prisma.opportunity.findMany({ where, select: { id: true, title: true } });
      for (const r of rows) out.set(`${type}:${r.id}`, { label: r.title, href: `${STANDARD_HREF[type]}/${r.id}` });
    } else {
      const moduleId = moduleIdFromEntityType(type);
      if (!moduleId) continue;
      const rows = await prisma.customRecord.findMany({
        where: { ...where, moduleId },
        select: { id: true, title: true, module: { select: { key: true } } },
      });
      for (const r of rows) out.set(`${type}:${r.id}`, { label: r.title, href: `/dashboard/m/${r.module.key}/${r.id}` });
    }
  }
  return out;
}
