// Catálogo de módulos y campos del CRM — puro (cliente y servidor).
//
// Es la ÚNICA descripción genérica de "qué campos tiene un módulo" que usan
// el motor de automatizaciones (condiciones y acciones), los paneles de
// Informes (métricas, agrupaciones y filtros) y la configuración de
// permisos. Los campos estándar salen de acá; los personalizados se suman
// en el servidor (modules/entities/registry.ts) a partir de
// CustomFieldDefinition, con la clave "cf:<definitionId>".
//
// Claves de campo:
//   estándar       el nombre de la columna (name, status, ownerId, amount…)
//   personalizado  "cf:<definitionId>" (estable aunque se renombre)

import { COMPANY_STATUS_LABELS, LEAD_SOURCE_LABELS, OPPORTUNITY_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { isModuleEntityType } from "@/lib/custom-modules";

export type FieldKind =
  | "text"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multiselect"
  | "user"
  | "relation"
  | "image"
  | "file";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldMeta {
  key: string;
  label: string;
  type: FieldKind;
  /** Opciones fijas (select/multiselect). Las dinámicas (estados, etapas) las completa el servidor. */
  options?: FieldOption[];
  /** Solo relation: entityType destino. */
  target?: string;
  multiple?: boolean;
  /** Se puede escribir desde una automatización ("Actualizar campo"). */
  writable: boolean;
  custom?: boolean;
  required?: boolean;
}

export const STANDARD_ENTITY_TYPES = ["lead", "contact", "company", "opportunity", "task"] as const;
export type StandardEntityType = (typeof STANDARD_ENTITY_TYPES)[number];

export function isStandardEntityType(v: string): v is StandardEntityType {
  return (STANDARD_ENTITY_TYPES as readonly string[]).includes(v);
}

/** Módulo estándar o personalizado ("cm:<id>"). */
export function isKnownEntityType(v: string) {
  return isStandardEntityType(v) || isModuleEntityType(v);
}

export interface StandardModuleInfo {
  entityType: StandardEntityType;
  singular: string;
  plural: string;
  /** Key en Workspace.activeModules (para ocultar módulos apagados). */
  activeKey: string;
  href: string;
  /** Campo que hace de "nombre" del registro. */
  titleField: string;
}

export const STANDARD_MODULES: StandardModuleInfo[] = [
  { entityType: "lead", singular: "Lead", plural: "Leads", activeKey: "leads", href: "/dashboard/leads", titleField: "name" },
  { entityType: "contact", singular: "Contacto", plural: "Contactos", activeKey: "contacts", href: "/dashboard/contactos", titleField: "name" },
  { entityType: "company", singular: "Empresa", plural: "Empresas", activeKey: "companies", href: "/dashboard/empresas", titleField: "name" },
  { entityType: "opportunity", singular: "Oportunidad", plural: "Oportunidades", activeKey: "opportunities", href: "/dashboard/oportunidades", titleField: "title" },
  { entityType: "task", singular: "Tarea", plural: "Tareas", activeKey: "tasks", href: "/dashboard/tareas", titleField: "title" },
];

export function standardModuleInfo(entityType: string) {
  return STANDARD_MODULES.find((m) => m.entityType === entityType);
}

const opts = (labels: Record<string, string>): FieldOption[] => Object.entries(labels).map(([value, label]) => ({ value, label }));

const CREATED: FieldMeta = { key: "createdAt", label: "Fecha de creación", type: "datetime", writable: false };
const UPDATED: FieldMeta = { key: "updatedAt", label: "Última actualización", type: "datetime", writable: false };
const OWNER: FieldMeta = { key: "ownerId", label: "Responsable", type: "user", writable: true };

// Campos estándar por módulo. Las opciones de `status` de Lead/Empresa y
// `stageId` de Oportunidad dependen del negocio: el servidor las completa.
export const STANDARD_FIELDS: Record<StandardEntityType, FieldMeta[]> = {
  lead: [
    { key: "name", label: "Nombre", type: "text", writable: true, required: true },
    { key: "email", label: "Email", type: "email", writable: true },
    { key: "phone", label: "Teléfono", type: "phone", writable: true },
    { key: "status", label: "Estado", type: "select", writable: true },
    { key: "statusReason", label: "Motivo del estado", type: "text", writable: true },
    { key: "source", label: "Origen", type: "select", options: opts(LEAD_SOURCE_LABELS), writable: false },
    OWNER,
    { key: "companyId", label: "Empresa", type: "relation", target: "company", writable: true },
    { key: "lastFollowUpAt", label: "Último seguimiento", type: "datetime", writable: false },
    { key: "convertedAt", label: "Fecha de conversión", type: "datetime", writable: false },
    CREATED,
    UPDATED,
  ],
  contact: [
    { key: "name", label: "Nombre", type: "text", writable: true, required: true },
    { key: "email", label: "Email", type: "email", writable: true },
    { key: "phone", label: "Teléfono", type: "phone", writable: true },
    OWNER,
    { key: "companyId", label: "Empresa", type: "relation", target: "company", writable: true },
    CREATED,
    UPDATED,
  ],
  company: [
    { key: "name", label: "Nombre", type: "text", writable: true, required: true },
    { key: "domain", label: "Dominio", type: "url", writable: true },
    { key: "phone", label: "Teléfono", type: "phone", writable: true },
    { key: "status", label: "Estado", type: "select", options: opts(COMPANY_STATUS_LABELS), writable: true },
    OWNER,
    CREATED,
    UPDATED,
  ],
  opportunity: [
    { key: "title", label: "Título", type: "text", writable: true, required: true },
    { key: "amount", label: "Valor", type: "currency", writable: true },
    { key: "stageId", label: "Etapa", type: "select", writable: true },
    { key: "status", label: "Estado", type: "select", options: opts(OPPORTUNITY_STATUS_LABELS), writable: false },
    OWNER,
    { key: "companyId", label: "Empresa", type: "relation", target: "company", writable: true },
    { key: "contactId", label: "Contacto", type: "relation", target: "contact", writable: true },
    { key: "closedAt", label: "Fecha de cierre", type: "datetime", writable: false },
    CREATED,
    UPDATED,
  ],
  task: [
    { key: "title", label: "Título", type: "text", writable: true, required: true },
    { key: "description", label: "Descripción", type: "text", writable: true },
    { key: "status", label: "Estado", type: "select", options: opts(TASK_STATUS_LABELS), writable: true },
    { key: "priority", label: "Prioridad", type: "select", options: opts(TASK_PRIORITY_LABELS), writable: true },
    { key: "startDate", label: "Inicio", type: "datetime", writable: true },
    { key: "dueAt", label: "Vencimiento", type: "datetime", writable: true },
    OWNER,
    { key: "companyId", label: "Empresa", type: "relation", target: "company", writable: true },
    { key: "contactId", label: "Contacto", type: "relation", target: "contact", writable: true },
    { key: "leadId", label: "Lead", type: "relation", target: "lead", writable: true },
    { key: "opportunityId", label: "Oportunidad", type: "relation", target: "opportunity", writable: true },
    { key: "completedAt", label: "Completada el", type: "datetime", writable: false },
    CREATED,
    UPDATED,
  ],
};

/** Campos estándar de un módulo personalizado (además de sus campos). */
export const CUSTOM_RECORD_FIELDS: FieldMeta[] = [
  { key: "title", label: "Nombre", type: "text", writable: true, required: true },
  OWNER,
  CREATED,
  UPDATED,
];

export const CUSTOM_FIELD_KEY_PREFIX = "cf:";
export const customFieldKey = (definitionId: string) => `${CUSTOM_FIELD_KEY_PREFIX}${definitionId}`;
export function definitionIdFromFieldKey(key: string): string | null {
  return key.startsWith(CUSTOM_FIELD_KEY_PREFIX) ? key.slice(CUSTOM_FIELD_KEY_PREFIX.length) : null;
}

/** Tipo de campo personalizado → FieldKind. */
export function kindForCustomType(type: string): FieldKind {
  const known: FieldKind[] = ["text", "email", "phone", "url", "number", "currency", "date", "datetime", "boolean", "select", "multiselect", "relation", "image", "file"];
  return (known as string[]).includes(type) ? (type as FieldKind) : "text";
}

// ── Operadores de condición por tipo de campo ───────────────────────────
// Los usan el motor de automatizaciones y los filtros de los paneles: un
// operador que no corresponde al tipo se rechaza al guardar (Zod +
// validateCondition en el servidor).

export const OPERATOR_LABELS: Record<string, string> = {
  equals: "es igual a",
  not_equals: "no es igual a",
  contains: "contiene",
  not_contains: "no contiene",
  starts_with: "empieza con",
  in: "es alguno de",
  not_in: "no es ninguno de",
  gt: "es mayor que",
  gte: "es mayor o igual que",
  lt: "es menor que",
  lte: "es menor o igual que",
  before: "es anterior a",
  after: "es posterior a",
  within_last_days: "en los últimos N días",
  older_than_days: "hace más de N días",
  is_true: "es Sí",
  is_false: "es No",
  is_empty: "está vacío",
  is_not_empty: "tiene valor",
  changed: "cambió",
  changed_to: "cambió a",
  changed_from: "cambió desde",
};

const EMPTY_OPS = ["is_empty", "is_not_empty"];
const CHANGE_OPS = ["changed", "changed_to", "changed_from"];

export const OPERATORS_BY_KIND: Record<FieldKind, string[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", ...EMPTY_OPS, ...CHANGE_OPS],
  email: ["equals", "not_equals", "contains", "not_contains", ...EMPTY_OPS, ...CHANGE_OPS],
  phone: ["equals", "not_equals", "contains", ...EMPTY_OPS, ...CHANGE_OPS],
  url: ["equals", "contains", ...EMPTY_OPS, ...CHANGE_OPS],
  number: ["equals", "not_equals", "gt", "gte", "lt", "lte", ...EMPTY_OPS, ...CHANGE_OPS],
  currency: ["equals", "not_equals", "gt", "gte", "lt", "lte", ...EMPTY_OPS, ...CHANGE_OPS],
  date: ["equals", "before", "after", "within_last_days", "older_than_days", ...EMPTY_OPS, ...CHANGE_OPS],
  datetime: ["before", "after", "within_last_days", "older_than_days", ...EMPTY_OPS, ...CHANGE_OPS],
  boolean: ["is_true", "is_false", ...CHANGE_OPS],
  select: ["equals", "not_equals", "in", "not_in", ...EMPTY_OPS, ...CHANGE_OPS],
  multiselect: ["contains", "not_contains", ...EMPTY_OPS, ...CHANGE_OPS],
  user: ["equals", "not_equals", "in", ...EMPTY_OPS, ...CHANGE_OPS],
  relation: ["contains", "not_contains", ...EMPTY_OPS, ...CHANGE_OPS],
  image: [...EMPTY_OPS, "changed"],
  file: [...EMPTY_OPS, "changed"],
};

/** Operadores que no llevan valor. */
export const VALUELESS_OPERATORS = new Set(["is_empty", "is_not_empty", "is_true", "is_false", "changed"]);
/** Operadores que comparan contra el estado ANTERIOR (solo en modificaciones). */
export const CHANGE_OPERATORS = new Set(CHANGE_OPS);
/** Operadores con lista de valores ("A,B"). */
export const LIST_OPERATORS = new Set(["in", "not_in"]);

export function operatorsFor(kind: FieldKind) {
  return OPERATORS_BY_KIND[kind] ?? OPERATORS_BY_KIND.text;
}

/** Tipos agrupables en un gráfico (valores discretos). */
export const GROUPABLE_KINDS = new Set<FieldKind>(["select", "multiselect", "user", "boolean", "relation", "text", "email", "phone", "date", "datetime"]);
/** Tipos sumables/promediables. */
export const NUMERIC_KINDS = new Set<FieldKind>(["number", "currency"]);
export const DATE_KINDS = new Set<FieldKind>(["date", "datetime"]);
