import { toIsoDate, toNumber } from "@/lib/custom-fields";
import { CHANGE_OPERATORS, LIST_OPERATORS, VALUELESS_OPERATORS, operatorsFor, type FieldMeta } from "@/lib/entities";
import type { WorkflowCondition, WorkflowConditionGroup } from "@/modules/automations/workflow-config";

// Evaluación de condiciones sobre snapshots (campo → valor). Pura y
// testeable: no lee la base. La usan el motor de automatizaciones y los
// filtros de los paneles de Informes.

export type Value = string | string[] | null | undefined;
export type Values = Record<string, Value>;

const DAY = 86_400_000;

export function isEmptyValue(v: Value) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function asList(v: Value): string[] {
  if (isEmptyValue(v)) return [];
  return Array.isArray(v) ? v : [v as string];
}

function sameValue(a: Value, b: Value) {
  const la = asList(a).map((x) => x.trim().toLowerCase()).sort();
  const lb = asList(b).map((x) => x.trim().toLowerCase()).sort();
  return la.length === lb.length && la.every((x, i) => x === lb[i]);
}

function toTime(v: string, kind: string): number | null {
  if (kind === "date") {
    const iso = toIsoDate(v);
    return iso ? new Date(`${iso}T00:00:00-03:00`).getTime() : null;
  }
  const t = new Date(v).getTime();
  if (Number.isFinite(t)) return t;
  const iso = toIsoDate(v.split(/[T ]/)[0] ?? "");
  return iso ? new Date(`${iso}T00:00:00-03:00`).getTime() : null;
}

/** Compara un valor (sin mirar el anterior) contra un operador "estático". */
function matchStatic(op: string, v: Value, expected: string, meta: FieldMeta, now: Date): boolean {
  const kind = meta.type;
  const list = asList(v);
  const first = list[0] ?? "";
  const lower = (s: string) => s.trim().toLowerCase();
  switch (op) {
    case "is_empty":
      return isEmptyValue(v);
    case "is_not_empty":
      return !isEmptyValue(v);
    case "is_true":
      return lower(first) === "true";
    case "is_false":
      return lower(first) !== "true";
    case "equals":
      if (kind === "number" || kind === "currency") return toNumber(first) !== null && toNumber(first) === toNumber(expected);
      if (kind === "date") return !!first && toIsoDate(first.slice(0, 10)) === toIsoDate(expected);
      return list.length > 0 && lower(first) === lower(expected);
    case "not_equals":
      if (kind === "number" || kind === "currency") return toNumber(first) !== toNumber(expected);
      return lower(first) !== lower(expected);
    case "contains":
      if (kind === "multiselect" || kind === "relation") return list.some((x) => lower(x) === lower(expected));
      return lower(first).includes(lower(expected));
    case "not_contains":
      if (kind === "multiselect" || kind === "relation") return !list.some((x) => lower(x) === lower(expected));
      return !lower(first).includes(lower(expected));
    case "starts_with":
      return lower(first).startsWith(lower(expected));
    case "in":
    case "not_in": {
      const options = expected.split(",").map(lower).filter(Boolean);
      const hit = list.some((x) => options.includes(lower(x)));
      return op === "in" ? hit : !hit;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNumber(first);
      const b = toNumber(expected);
      if (a === null || b === null) return false;
      return op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
    }
    case "before":
    case "after": {
      const a = first ? toTime(first, kind) : null;
      const b = toTime(expected, kind);
      if (a === null || b === null) return false;
      return op === "before" ? a < b : a > b;
    }
    case "within_last_days":
    case "older_than_days": {
      const a = first ? toTime(first, kind) : null;
      const days = Number.parseInt(expected, 10);
      if (a === null || !Number.isFinite(days)) return false;
      const limit = now.getTime() - days * DAY;
      return op === "within_last_days" ? a >= limit && a <= now.getTime() + DAY : a < limit;
    }
    default:
      return false;
  }
}

/**
 * Evalúa UNA condición. `before` null = alta (no hay estado anterior): en
 * ese caso "cambió a X" equivale a "es X" y "cambió" a "tiene valor".
 */
export function evaluateCondition(c: WorkflowCondition, meta: FieldMeta | undefined, after: Values, before: Values | null, now: Date = new Date()): boolean {
  if (!meta) return false; // campo borrado: la condición no se cumple (nunca "de más")
  const v = after[c.field];
  const expected = (c.value ?? "").trim();
  if (CHANGE_OPERATORS.has(c.op)) {
    const prev = before ? before[c.field] : undefined;
    const changed = before ? !sameValue(prev, v) : !isEmptyValue(v);
    if (c.op === "changed") return changed;
    if (c.op === "changed_to") return changed && matchStatic(meta.type === "multiselect" || meta.type === "relation" ? "contains" : "equals", v, expected, meta, now);
    // changed_from
    return !!before && changed && matchStatic(meta.type === "multiselect" || meta.type === "relation" ? "contains" : "equals", prev, expected, meta, now);
  }
  return matchStatic(c.op, v, expected, meta, now);
}

type GroupItem = WorkflowConditionGroup["conditions"][number];

export function evaluateGroup(group: WorkflowConditionGroup, fields: Map<string, FieldMeta>, after: Values, before: Values | null, now: Date = new Date()): boolean {
  if (group.conditions.length === 0) return true;
  const test = (item: GroupItem): boolean =>
    "conditions" in item
      ? evaluateGroup({ match: item.match, conditions: item.conditions }, fields, after, before, now)
      : evaluateCondition(item, fields.get(item.field), after, before, now);
  return group.match === "all" ? group.conditions.every(test) : group.conditions.some(test);
}

/** Valida una condición contra el tipo real del campo. Devuelve un mensaje o null. */
export function validateCondition(c: WorkflowCondition, meta: FieldMeta | undefined, opts: { allowChangeOps: boolean }): string | null {
  if (!meta) return "Ese campo ya no existe en el módulo.";
  if (!operatorsFor(meta.type).includes(c.op)) return `El operador no aplica a «${meta.label}».`;
  if (CHANGE_OPERATORS.has(c.op) && !opts.allowChangeOps) return "«Cambió» solo tiene sentido al modificar o antes de guardar.";
  if (VALUELESS_OPERATORS.has(c.op)) return null;
  const value = (c.value ?? "").trim();
  if (!value) return `Completá el valor para «${meta.label}».`;
  if (["gt", "gte", "lt", "lte"].includes(c.op) || ((meta.type === "number" || meta.type === "currency") && c.op === "equals")) {
    if (toNumber(value) === null) return `«${meta.label}»: el valor tiene que ser un número.`;
  }
  if (["within_last_days", "older_than_days"].includes(c.op) && !/^\d{1,4}$/.test(value)) return "Indicá una cantidad de días (número entero).";
  if (["before", "after"].includes(c.op) && toTime(value, meta.type) === null) return `«${meta.label}»: fecha inválida.`;
  if (meta.options?.length && (meta.type === "select" || meta.type === "multiselect") && !LIST_OPERATORS.has(c.op) && ["equals", "not_equals", "contains", "not_contains", "changed_to", "changed_from"].includes(c.op)) {
    if (!meta.options.some((o) => o.value === value)) return `«${value}» no es una opción de «${meta.label}».`;
  }
  return null;
}

export function validateGroup(group: WorkflowConditionGroup, fields: Map<string, FieldMeta>, opts: { allowChangeOps: boolean }): string | null {
  for (const item of group.conditions) {
    const msg = "conditions" in item ? validateGroup({ match: item.match, conditions: item.conditions }, fields, opts) : validateCondition(item, fields.get(item.field), opts);
    if (msg) return msg;
  }
  return null;
}
