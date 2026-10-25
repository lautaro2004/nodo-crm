import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatCustomValue, toNumber } from "@/lib/custom-fields";
import { DATE_KINDS, NUMERIC_KINDS, type FieldMeta } from "@/lib/entities";
import { can, canAdminister, scopeWhere, type ResolvedAccess } from "@/modules/access/service";
import { getModuleCatalog, loadAllSnapshots, type ModuleDescriptor, type RecordSnapshot } from "@/modules/entities/registry";
import { evaluateGroup, validateGroup } from "@/modules/automations/conditions";
import { listWorkspaceMembers } from "@/modules/business/members";
import { resolveLabels } from "@/modules/records/links";
import { MAX_DASHBOARDS, widgetSchema, type Widget } from "@/modules/reports/dashboard-config";

// Paneles de Informes guardados (crm.ReportDashboard). Cada panel tiene
// componentes (indicadores, barras, evolución, tablas) que consultan
// CUALQUIER módulo, estándar o personalizado. Los datos siempre se
// calculan en el servidor con el alcance de permisos de quien mira: un
// panel compartido nunca muestra registros que esa persona no podría ver.

type Actor = { userId: string; access: ResolvedAccess };

export async function listDashboards(businessId: string, actor: Actor) {
  return prisma.reportDashboard.findMany({
    where: { businessId, OR: [{ shared: true }, { createdBy: actor.userId }] },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

async function findEditable(businessId: string, id: string, actor: Actor) {
  const d = await prisma.reportDashboard.findFirst({ where: { id, businessId } });
  if (!d) return null;
  const mine = d.createdBy === actor.userId;
  if (!mine && !(d.shared && canAdminister(actor.access, "reports"))) throw new Error("forbidden");
  return d;
}

async function validateWidgets(businessId: string, widgets: Widget[]) {
  const catalog = await getModuleCatalog(businessId);
  for (const w of widgets) {
    const mod = catalog.find((m) => m.entityType === w.module);
    if (!mod) throw new Error("module_not_found");
    const fields = new Map(mod.fields.map((f) => [f.key, f]));
    if (w.metric.op !== "count" && !(w.metric.field && NUMERIC_KINDS.has(fields.get(w.metric.field)?.type ?? "text"))) throw new Error("invalid_config");
    if (w.type === "bar" && !(w.groupBy && fields.has(w.groupBy))) throw new Error("invalid_config");
    if (!DATE_KINDS.has(fields.get(w.dateField)?.type ?? "text")) throw new Error("invalid_config");
    if (validateGroup(w.filters, fields, { allowChangeOps: false })) throw new Error("invalid_config");
  }
}

export async function createDashboard(businessId: string, actor: Actor, data: { name: string; shared?: boolean; widgets?: Widget[] }) {
  if (data.shared && !canAdminister(actor.access, "reports")) throw new Error("forbidden");
  if ((await prisma.reportDashboard.count({ where: { businessId, createdBy: actor.userId } })) >= MAX_DASHBOARDS) throw new Error("too_many_dashboards");
  const widgets = (data.widgets ?? []).map((w) => widgetSchema.parse(w));
  await validateWidgets(businessId, widgets);
  const last = await prisma.reportDashboard.findFirst({ where: { businessId }, orderBy: { order: "desc" }, select: { order: true } });
  return prisma.reportDashboard.create({
    data: { businessId, name: data.name.trim(), shared: !!data.shared, createdBy: actor.userId, widgets: widgets as unknown as Prisma.InputJsonValue, order: (last?.order ?? -1) + 1 },
  });
}

export async function updateDashboard(businessId: string, id: string, actor: Actor, data: { name?: string; shared?: boolean; widgets?: Widget[]; order?: number }) {
  const d = await findEditable(businessId, id, actor);
  if (!d) return null;
  if (data.shared !== undefined && data.shared !== d.shared && !canAdminister(actor.access, "reports")) throw new Error("forbidden");
  let widgets: Widget[] | undefined;
  if (data.widgets) {
    widgets = data.widgets.map((w) => widgetSchema.parse(w));
    await validateWidgets(businessId, widgets);
  }
  return prisma.reportDashboard.update({
    where: { id: d.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.shared !== undefined ? { shared: data.shared } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
      ...(widgets ? { widgets: widgets as unknown as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function deleteDashboard(businessId: string, id: string, actor: Actor) {
  const d = await findEditable(businessId, id, actor);
  if (!d) return false;
  await prisma.reportDashboard.delete({ where: { id: d.id } });
  return true;
}

export function parseWidgets(json: unknown): Widget[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((w) => {
    const r = widgetSchema.safeParse(w);
    return r.success ? [r.data] : [];
  });
}

// ── Cálculo ─────────────────────────────────────────────────────────────

export type WidgetData =
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string }
  | { kind: "metric"; value: number; display: string; count: number; truncated: boolean }
  | { kind: "bar"; rows: { label: string; value: number; display: string }[]; truncated: boolean }
  | { kind: "line"; unit: "day" | "week" | "month"; points: { key: string; label: string; value: number }[]; truncated: boolean }
  | { kind: "table"; columns: string[]; rows: { id: string; href: string | null; cells: string[] }[]; total: number; truncated: boolean };

const DAY = 86_400_000;

function periodStart(period: Widget["period"], now: Date): Date | null {
  if (period === "all") return null;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getTime() - Number(period) * DAY);
}

const toTime = (v: unknown) => {
  if (typeof v !== "string" || !v) return null;
  const t = new Date(v.length === 10 ? `${v}T00:00:00-03:00` : v).getTime();
  return Number.isFinite(t) ? t : null;
};

function aggregate(items: RecordSnapshot[], metric: Widget["metric"]) {
  if (metric.op === "count" || !metric.field) return items.length;
  const nums = items.map((i) => toNumber(String(i.values[metric.field!] ?? ""))).filter((n): n is number => n !== null);
  const total = nums.reduce((a, b) => a + b, 0);
  return metric.op === "sum" ? total : nums.length ? total / nums.length : 0;
}

function formatMetric(value: number, metric: Widget["metric"], fields: Map<string, FieldMeta>) {
  if (metric.op === "count") return value.toLocaleString("es-AR");
  const type = metric.field ? fields.get(metric.field)?.type : undefined;
  const rounded = Math.round(value * 100) / 100;
  return type === "currency" ? `$${rounded.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : rounded.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

const AR = (t: number) => new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * Calcula los datos de los componentes de un panel con el alcance de
 * permisos de quien mira. Los registros de un mismo módulo se leen UNA vez
 * por panel (hasta REPORT_RECORD_LIMIT por módulo; si hay más, se avisa).
 */
export async function computeWidgets(businessId: string, access: ResolvedAccess, widgets: Widget[], now: Date = new Date()): Promise<Record<string, WidgetData>> {
  const out: Record<string, WidgetData> = {};
  if (widgets.length === 0) return out;
  const catalog = await getModuleCatalog(businessId, { includeArchived: true });
  const members = await listWorkspaceMembers(businessId);
  const memberName = new Map(members.map((m) => [m.userId, m.name || m.email]));
  const cache = new Map<string, Promise<{ items: RecordSnapshot[]; truncated: boolean }>>();
  const load = (mod: ModuleDescriptor) => {
    if (!cache.has(mod.entityType)) {
      const scope = scopeWhere(access, mod.entityType, { createdByField: mod.entityType === "task" || mod.custom ? "createdById" : undefined });
      cache.set(mod.entityType, loadAllSnapshots(businessId, mod.entityType, scope));
    }
    return cache.get(mod.entityType)!;
  };

  for (const w of widgets) {
    try {
      const mod = catalog.find((m) => m.entityType === w.module);
      if (!mod) {
        out[w.id] = { kind: "error", message: "El módulo de este componente ya no existe." };
        continue;
      }
      if (!can(access, mod.entityType, "view")) {
        out[w.id] = { kind: "denied", message: `No tenés acceso a ${mod.plural.toLowerCase()}.` };
        continue;
      }
      const fields = new Map(mod.fields.map((f) => [f.key, f]));
      const { items: all, truncated } = await load(mod);
      const start = periodStart(w.period, now);
      const items = all.filter((s) => {
        if (start) {
          const t = toTime(s.values[w.dateField]);
          if (t === null || t < start.getTime()) return false;
        }
        return evaluateGroup(w.filters, fields, s.values, null, now);
      });

      if (w.type === "metric") {
        const value = aggregate(items, w.metric);
        out[w.id] = { kind: "metric", value, display: formatMetric(value, w.metric, fields), count: items.length, truncated };
      } else if (w.type === "bar") {
        const meta = fields.get(w.groupBy ?? "");
        if (!meta) throw new Error("El campo para agrupar ya no existe.");
        const groups = new Map<string, RecordSnapshot[]>();
        for (const s of items) {
          const raw = s.values[meta.key];
          let keys = Array.isArray(raw) ? raw : raw ? [raw] : [];
          if (DATE_KINDS.has(meta.type)) keys = keys.map((k) => k.slice(0, 7)); // por mes
          if (keys.length === 0) keys = ["__empty__"];
          for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), s]);
        }
        const relationLabels =
          meta.type === "relation" && meta.target ? await resolveLabels(businessId, Array.from(groups.keys()).filter((k) => k !== "__empty__").map((id) => ({ type: meta.target!, id }))) : null;
        const labelFor = (k: string) => {
          if (k === "__empty__") return "Sin valor";
          if (meta.type === "user") return memberName.get(k) ?? "Ex miembro";
          if (relationLabels) return relationLabels.get(`${meta.target}:${k}`)?.label ?? "Registro eliminado";
          if (DATE_KINDS.has(meta.type)) return `${k.slice(5, 7)}/${k.slice(0, 4)}`;
          return meta.options?.find((o) => o.value === k)?.label ?? formatCustomValue(meta.type, k) ?? k;
        };
        const rows = Array.from(groups.entries())
          .map(([k, list]) => {
            const value = aggregate(list, w.metric);
            return { label: labelFor(k), value, display: formatMetric(value, w.metric, fields) };
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, w.limit);
        out[w.id] = { kind: "bar", rows, truncated };
      } else if (w.type === "line") {
        const times = items.map((s) => ({ s, t: toTime(s.values[w.dateField]) })).filter((x): x is { s: RecordSnapshot; t: number } => x.t !== null);
        const from = start?.getTime() ?? (times.length ? Math.min(...times.map((x) => x.t)) : now.getTime());
        const days = Math.max(1, Math.round((now.getTime() - from) / DAY) + 1);
        const unit: "day" | "week" | "month" = days <= 31 ? "day" : days <= 180 ? "week" : "month";
        const bucket = (t: number) => {
          const k = AR(t);
          if (unit === "day") return k;
          if (unit === "month") return k.slice(0, 7);
          const d = new Date(`${k}T00:00:00Z`);
          return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
        };
        const buckets = new Map<string, RecordSnapshot[]>();
        for (let t = from; t <= now.getTime(); t += unit === "month" ? 28 * DAY : DAY) buckets.set(bucket(t), []);
        buckets.set(bucket(now.getTime()), buckets.get(bucket(now.getTime())) ?? []);
        for (const { s, t } of times) {
          const k = bucket(t);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k)!.push(s);
        }
        const points = Array.from(buckets.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, list]) => ({
            key,
            label: unit === "month" ? `${key.slice(5, 7)}/${key.slice(2, 4)}` : `${unit === "week" ? "sem " : ""}${key.slice(8, 10)}/${key.slice(5, 7)}`,
            value: aggregate(list, w.metric),
          }));
        out[w.id] = { kind: "line", unit, points, truncated };
      } else {
        const columns = (w.columns.length ? w.columns : [mod.fields[0]?.key]).filter((k) => fields.has(k));
        const relKeys = columns.filter((k) => fields.get(k)!.type === "relation");
        const sorted = [...items].sort((a, b) => (toTime(b.values[w.dateField]) ?? 0) - (toTime(a.values[w.dateField]) ?? 0)).slice(0, w.limit);
        const refs = sorted.flatMap((s) => relKeys.flatMap((k) => ((s.values[k] as string[]) ?? []).map((id) => ({ type: fields.get(k)!.target!, id }))));
        const labels = refs.length ? await resolveLabels(businessId, refs) : new Map();
        const cell = (s: RecordSnapshot, k: string) => {
          const meta = fields.get(k)!;
          const v = s.values[k];
          if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) return "—";
          if (meta.type === "user") return memberName.get(String(v)) ?? "—";
          if (meta.type === "relation") return (v as string[]).map((id) => labels.get(`${meta.target}:${id}`)?.label ?? "—").join(", ");
          if (Array.isArray(v)) return v.join(", ");
          if (meta.options?.length) return meta.options.find((o) => o.value === v)?.label ?? v;
          if (meta.type === "datetime" || (meta.type === "date" && v.length > 10)) return new Date(v).toLocaleDateString("es-AR");
          return formatCustomValue(meta.type, v) || v;
        };
        out[w.id] = {
          kind: "table",
          columns: columns.map((k) => fields.get(k)!.label),
          rows: sorted.map((s) => ({ id: s.id, href: `${mod.href}/${s.id}`, cells: columns.map((k) => cell(s, k)) })),
          total: items.length,
          truncated,
        };
      }
    } catch (err) {
      out[w.id] = { kind: "error", message: err instanceof Error && !err.message.includes("_") ? err.message : "No se pudo calcular este componente." };
    }
  }
  return out;
}
