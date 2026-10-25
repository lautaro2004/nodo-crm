import { Prisma } from "@prisma/client";

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
    case "task":
      rows = await prisma.task.findMany({ where, select });
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
 * o si el campo es "a uno" y llegan varios, y "relation_target_taken" si el
 * campo es exclusivo (uno a uno / uno a muchos) y el destino ya está
 * vinculado a OTRO registro — eso lo garantiza además la base
 * (unique definitionId + exclusiveTo).
 */
export async function setRelationLinks(
  businessId: string,
  definition: { id: string; targetEntity: string | null; multiple: boolean; exclusive?: boolean },
  fromType: string,
  fromId: string,
  toIds: string[]
) {
  if (!definition.targetEntity) throw new Error("invalid_relation");
  if (!definition.multiple && toIds.length > 1) throw new Error("invalid_relation");
  if (definition.targetEntity === fromType && toIds.includes(fromId)) throw new Error("invalid_relation");
  const found = await existingIds(businessId, definition.targetEntity, toIds);
  if (found.size !== toIds.length) throw new Error("invalid_relation");

  if (definition.exclusive && toIds.length) {
    const taken = await prisma.recordLink.count({ where: { definitionId: definition.id, toId: { in: toIds }, fromId: { not: fromId } } });
    if (taken > 0) throw new Error("relation_target_taken");
  }

  try {
    await prisma.$transaction([
      prisma.recordLink.deleteMany({ where: { businessId, definitionId: definition.id, fromId, toId: { notIn: toIds } } }),
      ...toIds.map((toId) =>
        prisma.recordLink.upsert({
          where: { definitionId_fromId_toId: { definitionId: definition.id, fromId, toId } },
          create: {
            businessId,
            definitionId: definition.id,
            fromType,
            fromId,
            toType: definition.targetEntity!,
            toId,
            exclusiveTo: definition.exclusive ? toId : null,
          },
          update: {},
        })
      ),
    ]);
  } catch (err) {
    // Carrera entre dos requests que vinculan el mismo destino exclusivo.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new Error("relation_target_taken");
    throw err;
  }
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

const STANDARD_PLURAL: Record<string, string> = { lead: "Leads", contact: "Contactos", company: "Empresas", opportunity: "Oportunidades", task: "Tareas" };

/**
 * Vínculos entrantes ("¿qué apunta a este registro?"), agrupados por el
 * campo relación: desde módulos personalizados no archivados Y desde
 * campos relación de los módulos estándar. `canSee` filtra los módulos de
 * origen que la persona no puede ver (permisos).
 */
export async function incomingLinks(
  businessId: string,
  toType: string,
  toId: string,
  canSee: (entityType: string) => boolean = () => true
) {
  const links = await prisma.recordLink.findMany({
    where: { businessId, toType, toId },
    include: {
      definition: { select: { id: true, label: true, inverseLabel: true, entityType: true, moduleId: true, module: { select: { labelPlural: true, archivedAt: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const visible = links.filter((l) => !l.definition.module?.archivedAt && canSee(l.fromType));
  const labels = await resolveLabels(businessId, visible.map((l) => ({ type: l.fromType, id: l.fromId })));
  const groups = new Map<string, { title: string; definitionId: string; fromType: string; items: { id: string; label: string; href: string }[] }>();
  for (const l of visible) {
    const info = labels.get(`${l.fromType}:${l.fromId}`);
    if (!info) continue;
    const key = l.definition.id;
    const source = l.definition.module?.labelPlural ?? STANDARD_PLURAL[l.definition.entityType] ?? "";
    const title = l.definition.inverseLabel || (source ? `${source} · ${l.definition.label}` : l.definition.label);
    if (!groups.has(key)) groups.set(key, { title, definitionId: key, fromType: l.fromType, items: [] });
    groups.get(key)!.items.push({ id: l.fromId, ...info });
  }
  return Array.from(groups.values());
}

const STANDARD_HREF: Record<string, string> = {
  contact: "/dashboard/contactos",
  company: "/dashboard/empresas",
  opportunity: "/dashboard/oportunidades",
  lead: "/dashboard/leads",
  task: "/dashboard/tareas",
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
    } else if (type === "opportunity" || type === "task") {
      const rows =
        type === "opportunity"
          ? await prisma.opportunity.findMany({ where, select: { id: true, title: true } })
          : await prisma.task.findMany({ where, select: { id: true, title: true } });
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
