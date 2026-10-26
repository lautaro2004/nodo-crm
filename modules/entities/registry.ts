import { prisma } from "@/lib/prisma";
import { splitMultiValue } from "@/lib/custom-fields";
import { moduleEntityType, moduleIdFromEntityType } from "@/lib/custom-modules";
import {
  CUSTOM_RECORD_FIELDS,
  STANDARD_FIELDS,
  STANDARD_MODULES,
  customFieldKey,
  isStandardEntityType,
  kindForCustomType,
  type FieldMeta,
  type FieldOption,
  type StandardEntityType,
} from "@/lib/entities";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { getModuleLabel } from "@/modules/workspace/module-config";

// Catálogo de módulos/campos de UN negocio (estándar + personalizados) y
// "fotos" (snapshots) de registros como mapa campo → valor. Lo usan el
// motor de automatizaciones y los paneles de Informes. Server-only.

/** Valor normalizado de un campo: texto canónico, lista (multiselect/relación) o vacío. */
export type FieldValue = string | string[] | null;

export interface RecordSnapshot {
  id: string;
  entityType: string;
  title: string;
  ownerId: string | null;
  createdById: string | null;
  values: Record<string, FieldValue>;
}

export interface ModuleDescriptor {
  entityType: string;
  singular: string;
  plural: string;
  /** Base de la URL de detalle: `${href}/${id}`. */
  href: string;
  /** Key en Workspace.activeModules (null en módulos personalizados). */
  activeKey: string | null;
  custom: boolean;
  fields: FieldMeta[];
}

async function dynamicOptions(businessId: string, entityType: StandardEntityType): Promise<Record<string, FieldOption[]>> {
  if (entityType === "lead") {
    const s = await listStatusOptions(businessId, "lead");
    return { status: s.map((o) => ({ value: o.key, label: o.label })) };
  }
  if (entityType === "company") {
    const s = await listStatusOptions(businessId, "company");
    return { status: s.map((o) => ({ value: o.key, label: o.label })) };
  }
  if (entityType === "opportunity") {
    const pipelines = await prisma.pipeline.findMany({
      where: { businessId },
      include: { stages: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    const multi = pipelines.length > 1;
    return { stageId: pipelines.flatMap((p) => p.stages.map((s) => ({ value: s.id, label: multi ? `${p.name} · ${s.label}` : s.label }))) };
  }
  return {};
}

function customFieldMeta(d: { id: string; label: string; type: string; options: string[]; targetEntity: string | null; multiple: boolean; required: boolean }): FieldMeta {
  return {
    key: customFieldKey(d.id),
    label: d.label,
    type: kindForCustomType(d.type),
    options: d.options.map((o) => ({ value: o, label: o })),
    target: d.targetEntity ?? undefined,
    multiple: d.type === "relation" ? d.multiple : d.type === "multiselect",
    writable: d.type !== "image" && d.type !== "file",
    custom: true,
    required: d.required,
  };
}

/** Todos los módulos del negocio con sus campos (estándar + personalizados). */
export async function getModuleCatalog(businessId: string, options: { includeArchived?: boolean } = {}): Promise<ModuleDescriptor[]> {
  const [defs, modules, opportunityLabel] = await Promise.all([
    prisma.customFieldDefinition.findMany({ where: { businessId }, orderBy: { order: "asc" } }),
    prisma.customModule.findMany({ where: { businessId, ...(options.includeArchived ? {} : { archivedAt: null }) }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    getModuleLabel(businessId, "opportunity"),
  ]);
  const out: ModuleDescriptor[] = [];
  for (const m of STANDARD_MODULES) {
    const dyn = await dynamicOptions(businessId, m.entityType);
    const fields = STANDARD_FIELDS[m.entityType].map((f) => (dyn[f.key] ? { ...f, options: dyn[f.key] } : f));
    const custom = defs.filter((d) => d.entityType === m.entityType).map(customFieldMeta);
    const isOpp = m.entityType === "opportunity";
    out.push({
      entityType: m.entityType,
      singular: isOpp ? opportunityLabel.labelSingular : m.singular,
      plural: isOpp ? opportunityLabel.labelPlural : m.plural,
      href: m.href,
      activeKey: m.activeKey,
      custom: false,
      fields: [...fields, ...custom],
    });
  }
  for (const mod of modules) {
    const entityType = moduleEntityType(mod.id);
    out.push({
      entityType,
      singular: mod.labelSingular,
      plural: mod.labelPlural,
      href: `/dashboard/m/${mod.key}`,
      activeKey: null,
      custom: true,
      fields: [...CUSTOM_RECORD_FIELDS, ...defs.filter((d) => d.entityType === entityType).map(customFieldMeta)],
    });
  }
  return out;
}

export async function getModuleDescriptor(businessId: string, entityType: string): Promise<ModuleDescriptor | null> {
  if (!isStandardEntityType(entityType) && !moduleIdFromEntityType(entityType)) return null;
  const catalog = await getModuleCatalog(businessId, { includeArchived: true });
  return catalog.find((m) => m.entityType === entityType) ?? null;
}

/** Campos de un módulo (sin opciones dinámicas: más barato, para evaluar condiciones). */
export async function getFieldMap(businessId: string, entityType: string): Promise<Map<string, FieldMeta>> {
  const base = isStandardEntityType(entityType) ? STANDARD_FIELDS[entityType] : CUSTOM_RECORD_FIELDS;
  const defs = await prisma.customFieldDefinition.findMany({ where: { businessId, entityType } });
  return new Map([...base, ...defs.map(customFieldMeta)].map((f) => [f.key, f]));
}

// ── Snapshots ───────────────────────────────────────────────────────────

const str = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

type Row = Record<string, unknown> & { id: string };

async function loadStandardRows(businessId: string, entityType: StandardEntityType, where: Record<string, unknown>, take?: number): Promise<Row[]> {
  const args = { where: { businessId, ...where }, ...(take ? { take, orderBy: { createdAt: "desc" as const } } : {}) };
  switch (entityType) {
    case "lead":
      return (await prisma.lead.findMany(args)) as Row[];
    case "contact":
      return (await prisma.contact.findMany(args)) as Row[];
    case "company":
      return (await prisma.company.findMany(args)) as Row[];
    case "opportunity":
      return (await prisma.opportunity.findMany(args)) as Row[];
    case "task":
      return (await prisma.task.findMany(args)) as Row[];
  }
}

async function buildSnapshots(businessId: string, entityType: string, rows: Row[]): Promise<RecordSnapshot[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const defs = await prisma.customFieldDefinition.findMany({ where: { businessId, entityType }, select: { id: true, type: true } });
  const relationDefs = defs.filter((d) => d.type === "relation").map((d) => d.id);
  const [values, links] = await Promise.all([
    defs.length
      ? prisma.customFieldValue.findMany({ where: { entityId: { in: ids }, definition: { businessId, entityType } }, select: { definitionId: true, entityId: true, value: true } })
      : Promise.resolve([]),
    relationDefs.length
      ? prisma.recordLink.findMany({ where: { businessId, definitionId: { in: relationDefs }, fromId: { in: ids } }, select: { definitionId: true, fromId: true, toId: true } })
      : Promise.resolve([]),
  ]);
  const typeById = new Map(defs.map((d) => [d.id, d.type]));
  const standardFields = isStandardEntityType(entityType) ? STANDARD_FIELDS[entityType] : CUSTOM_RECORD_FIELDS;
  const titleKey = isStandardEntityType(entityType) ? STANDARD_MODULES.find((m) => m.entityType === entityType)!.titleField : "title";

  const byId = new Map<string, RecordSnapshot>();
  for (const r of rows) {
    const vals: Record<string, FieldValue> = {};
    for (const f of standardFields) {
      const raw = r[f.key];
      vals[f.key] = f.type === "relation" ? (raw ? [String(raw)] : []) : str(raw);
    }
    for (const d of defs) vals[customFieldKey(d.id)] = d.type === "relation" || d.type === "multiselect" ? [] : null;
    byId.set(r.id, {
      id: r.id,
      entityType,
      title: String(r[titleKey] ?? ""),
      ownerId: (r.ownerId as string | null) ?? null,
      createdById: (r.createdById as string | null | undefined) ?? null,
      values: vals,
    });
  }
  for (const v of values) {
    const snap = byId.get(v.entityId);
    if (!snap) continue;
    const type = typeById.get(v.definitionId);
    snap.values[customFieldKey(v.definitionId)] = type === "multiselect" ? splitMultiValue(v.value) : v.value;
  }
  for (const l of links) {
    const snap = byId.get(l.fromId);
    if (!snap) continue;
    const key = customFieldKey(l.definitionId);
    snap.values[key] = [...((snap.values[key] as string[]) ?? []), l.toId];
  }
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

export async function loadSnapshots(businessId: string, entityType: string, ids: string[]): Promise<RecordSnapshot[]> {
  if (ids.length === 0) return [];
  if (isStandardEntityType(entityType)) return buildSnapshots(businessId, entityType, await loadStandardRows(businessId, entityType, { id: { in: ids } }));
  const moduleId = moduleIdFromEntityType(entityType);
  if (!moduleId) return [];
  const rows = (await prisma.customRecord.findMany({ where: { businessId, moduleId, id: { in: ids } } })) as unknown as Row[];
  return buildSnapshots(businessId, entityType, rows);
}

export async function loadSnapshot(businessId: string, entityType: string, id: string): Promise<RecordSnapshot | null> {
  return (await loadSnapshots(businessId, entityType, [id]))[0] ?? null;
}

/** Tope de registros que un panel de Informes procesa por módulo. */
export const REPORT_RECORD_LIMIT = 20_000;

/**
 * Snapshots de TODOS los registros de un módulo (con el alcance de
 * permisos ya aplicado vía `scope`), para los paneles de Informes. Los
 * registros archivados de módulos personalizados no cuentan.
 */
export async function loadAllSnapshots(
  businessId: string,
  entityType: string,
  scope: Record<string, unknown> = {},
  limit = REPORT_RECORD_LIMIT
): Promise<{ items: RecordSnapshot[]; truncated: boolean }> {
  let rows: Row[];
  if (isStandardEntityType(entityType)) {
    rows = await loadStandardRows(businessId, entityType, scope, limit + 1);
  } else {
    const moduleId = moduleIdFromEntityType(entityType);
    if (!moduleId) return { items: [], truncated: false };
    rows = (await prisma.customRecord.findMany({ where: { businessId, moduleId, archivedAt: null, ...scope }, take: limit + 1, orderBy: { createdAt: "desc" } })) as unknown as Row[];
  }
  const truncated = rows.length > limit;
  const items: RecordSnapshot[] = [];
  // Por lotes: evita un IN gigante en las consultas de valores.
  const slice = truncated ? rows.slice(0, limit) : rows;
  for (let i = 0; i < slice.length; i += 1000) items.push(...(await buildSnapshots(businessId, entityType, slice.slice(i, i + 1000))));
  return { items, truncated };
}
