import { prisma } from "@/lib/prisma";
import { COMPANY_STATUS_LABELS } from "@/lib/labels";

export type StatusEntityType = "lead" | "company";

export interface CreateStatusDefinitionInput {
  entityType: StatusEntityType;
  key: string;
  label: string;
  color?: string | null;
  order?: number;
  isDefault?: boolean;
}

export async function createStatusDefinition(businessId: string, data: CreateStatusDefinitionInput) {
  const existing = await prisma.statusDefinition.findFirst({
    where: { businessId, entityType: data.entityType, key: data.key },
    select: { id: true },
  });
  if (existing) throw new Error("status_key_taken");
  // Un estado nuevo va al final de la lista (antes quedaba con order 0 y
  // aparecía primero, mezclado con el estado inicial).
  const max = await prisma.statusDefinition.aggregate({
    where: { businessId, entityType: data.entityType },
    _max: { order: true },
  });
  return prisma.statusDefinition.create({
    data: {
      businessId,
      entityType: data.entityType,
      key: data.key,
      label: data.label,
      color: data.color ?? null,
      order: data.order ?? (max._max.order ?? -1) + 1,
      isDefault: data.isDefault ?? false,
    },
  });
}

export async function listStatusDefinitions(businessId: string, entityType?: StatusEntityType) {
  return prisma.statusDefinition.findMany({
    where: { businessId, ...(entityType ? { entityType } : {}) },
    orderBy: { order: "asc" },
  });
}

export async function updateStatusDefinition(
  businessId: string,
  id: string,
  data: Partial<Omit<CreateStatusDefinitionInput, "entityType" | "key">>
) {
  const result = await prisma.statusDefinition.updateMany({ where: { id, businessId }, data });
  return result.count > 0;
}

// Claves que el propio sistema escribe sin pasar por la configuración
// (default de createLead, sincronización con Nexo, archivar empresa,
// conversión) — siempre válidas aunque el Workspace no las haya definido.
const BUILTIN_STATUS_KEYS: Record<StatusEntityType, string[]> = {
  lead: ["new", "converted"],
  company: ["prospect", "customer", "archived"],
};

// Lead.status / Company.status son texto libre en la base (configurables
// por Workspace) — sin esta validación la API aceptaba cualquier string y
// el registro quedaba con un estado que ninguna pantalla sabe mostrar ni
// filtrar.
export async function assertValidStatus(businessId: string, entityType: StatusEntityType, key: string | undefined) {
  if (!key || BUILTIN_STATUS_KEYS[entityType].includes(key)) return;
  const exists = await prisma.statusDefinition.findFirst({ where: { businessId, entityType, key }, select: { id: true } });
  if (!exists) throw new Error("invalid_status");
}

// No se borra un estado que todavía usan registros reales: dejaría Leads/
// Empresas con un estado huérfano (sin label ni color, invisibles para los
// filtros y fuera de toda columna del Kanban).
export async function deleteStatusDefinition(businessId: string, id: string) {
  const definition = await prisma.statusDefinition.findFirst({ where: { id, businessId } });
  if (!definition) return false;
  const inUse =
    definition.entityType === "lead"
      ? await prisma.lead.count({ where: { businessId, status: definition.key } })
      : await prisma.company.count({ where: { businessId, status: definition.key } });
  if (inUse > 0) throw new Error("status_in_use");
  const result = await prisma.statusDefinition.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

// Reordenar: recibe los ids en el orden final. Cada update va scopeado por
// businessId + entityType, así un id ajeno simplemente no matchea.
export async function reorderStatusDefinitions(businessId: string, entityType: StatusEntityType, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, order) => prisma.statusDefinition.updateMany({ where: { id, businessId, entityType }, data: { order } }))
  );
  return true;
}

export interface StatusOption {
  key: string;
  label: string;
  color: string | null;
}

// Opciones de estado listas para la UI (badges, selects, columnas Kanban),
// en el orden configurado. Para Empresa se completan los estados del
// sistema (prospect/customer/archived) si el Workspace no los definió —
// antes la UI de Empresas ignoraba la configuración y usaba siempre esa
// lista fija.
export async function listStatusOptions(businessId: string, entityType: StatusEntityType): Promise<StatusOption[]> {
  const defs = await listStatusDefinitions(businessId, entityType);
  const options: StatusOption[] = defs.map((d) => ({ key: d.key, label: d.label, color: d.color }));
  if (entityType === "company") {
    for (const [key, label] of Object.entries(COMPANY_STATUS_LABELS)) {
      if (!options.some((o) => o.key === key)) options.push({ key, label, color: null });
    }
  } else {
    if (!options.some((o) => o.key === "new")) options.unshift({ key: "new", label: "Nuevo", color: null });
    if (!options.some((o) => o.key === "converted")) options.push({ key: "converted", label: "Convertido", color: "emerald" });
  }
  return options;
}

// Para un key que ya no existe en la configuración (dato viejo/importado):
// se muestra el key crudo en gris, nunca se rompe la pantalla.
export function findStatusOption(options: StatusOption[], key: string): StatusOption {
  return options.find((o) => o.key === key) ?? { key, label: key, color: null };
}
