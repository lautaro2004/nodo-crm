import { prisma } from "@/lib/prisma";
import { isStandardEntityType, STANDARD_FIELDS, STANDARD_MODULES } from "@/lib/entities";
import { moduleIdFromEntityType } from "@/lib/custom-modules";

// "Registros relacionados" de un módulo, para la acción "Actualizar
// registros relacionados". Una ruta (`via`) puede ser:
//   fk:<campo>             FK estándar saliente (contacto → su empresa)
//   rev:<módulo>.<campo>   FK estándar entrante (empresa → sus contactos)
//   out:<definitionId>     campo relación saliente (colaboración → contacto)
//   in:<definitionId>      campo relación entrante (contacto → sus colaboraciones)

export interface RelatedPath {
  via: string;
  label: string;
  target: string;
}

const moduleLabel = (entityType: string, customLabels: Map<string, string>) =>
  STANDARD_MODULES.find((m) => m.entityType === entityType)?.plural ?? customLabels.get(entityType) ?? entityType;

export async function relatedPathsFor(businessId: string, entityType: string): Promise<RelatedPath[]> {
  const [defs, modules] = await Promise.all([
    prisma.customFieldDefinition.findMany({ where: { businessId, type: "relation" }, select: { id: true, label: true, entityType: true, targetEntity: true } }),
    prisma.customModule.findMany({ where: { businessId }, select: { id: true, labelPlural: true } }),
  ]);
  const labels = new Map(modules.map((m) => [`cm:${m.id}`, m.labelPlural]));
  const out: RelatedPath[] = [];
  if (isStandardEntityType(entityType)) {
    for (const f of STANDARD_FIELDS[entityType]) if (f.type === "relation" && f.target) out.push({ via: `fk:${f.key}`, label: f.label, target: f.target });
  }
  for (const m of STANDARD_MODULES) {
    for (const f of STANDARD_FIELDS[m.entityType]) {
      if (f.type === "relation" && f.target === entityType) out.push({ via: `rev:${m.entityType}.${f.key}`, label: `${m.plural} (por ${f.label})`, target: m.entityType });
    }
  }
  for (const d of defs) {
    if (d.entityType === entityType && d.targetEntity) out.push({ via: `out:${d.id}`, label: d.label, target: d.targetEntity });
    if (d.targetEntity === entityType) out.push({ via: `in:${d.id}`, label: `${moduleLabel(d.entityType, labels)} (por ${d.label})`, target: d.entityType });
  }
  return out;
}

const MAX_RELATED = 200;

/** Ids de los registros relacionados por `via` (scopeados al negocio). */
export async function resolveRelatedIds(businessId: string, entityType: string, recordId: string, via: string): Promise<{ target: string; ids: string[] } | null> {
  const [kind, rest] = [via.slice(0, via.indexOf(":")), via.slice(via.indexOf(":") + 1)];
  if (kind === "fk" && isStandardEntityType(entityType)) {
    const f = STANDARD_FIELDS[entityType].find((x) => x.key === rest && x.type === "relation");
    if (!f?.target) return null;
    const delegate = (prisma as unknown as Record<string, { findFirst: (a: unknown) => Promise<Record<string, unknown> | null> }>)[entityType];
    const row = await delegate.findFirst({ where: { id: recordId, businessId }, select: { [rest]: true } });
    const id = row?.[rest] as string | null | undefined;
    return { target: f.target, ids: id ? [id] : [] };
  }
  if (kind === "rev") {
    const [source, field] = rest.split(".");
    if (!isStandardEntityType(source)) return null;
    const f = STANDARD_FIELDS[source].find((x) => x.key === field && x.type === "relation" && x.target === entityType);
    if (!f) return null;
    const delegate = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<{ id: string }[]> }>)[source];
    const rows = await delegate.findMany({ where: { businessId, [field]: recordId }, select: { id: true }, take: MAX_RELATED });
    return { target: source, ids: rows.map((r) => r.id) };
  }
  if (kind === "out" || kind === "in") {
    const def = await prisma.customFieldDefinition.findFirst({ where: { id: rest, businessId, type: "relation" }, select: { id: true, entityType: true, targetEntity: true } });
    if (!def?.targetEntity) return null;
    if (kind === "out") {
      if (def.entityType !== entityType) return null;
      const links = await prisma.recordLink.findMany({ where: { businessId, definitionId: def.id, fromId: recordId }, select: { toId: true }, take: MAX_RELATED });
      return { target: def.targetEntity, ids: links.map((l) => l.toId) };
    }
    if (def.targetEntity !== entityType) return null;
    const links = await prisma.recordLink.findMany({ where: { businessId, definitionId: def.id, toId: recordId }, select: { fromId: true }, take: MAX_RELATED });
    const target = def.entityType;
    if (!moduleIdFromEntityType(target) && !isStandardEntityType(target)) return null;
    return { target, ids: links.map((l) => l.fromId) };
  }
  return null;
}
