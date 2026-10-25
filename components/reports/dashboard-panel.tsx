"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { HBars } from "@/components/reports/charts";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";
import { DATE_KINDS, GROUPABLE_KINDS, NUMERIC_KINDS } from "@/lib/entities";
import { ConditionList, MatchToggle, type BuilderModule } from "@/components/automations/workflow-builder";
import { PERIODS, PERIOD_LABELS, WIDGET_TYPES, WIDGET_TYPE_LABELS, type Widget } from "@/modules/reports/dashboard-config";
import type { WidgetData } from "@/modules/reports/dashboards";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false as const, error: "Sin conexión. El cambio no se guardó." };
  if (!res.ok) return { ok: false as const, error: await readApiError(res) };
  return { ok: true as const, data: await res.json().catch(() => ({})) };
}

// Pestañas de Informes: "General" + paneles guardados + crear.
export function DashboardTabs({ active, defaultId, dashboards }: { active: string; defaultId: string; dashboards: { id: string; name: string; shared: boolean }[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tab = (id: string, label: string, extra?: React.ReactNode) => (
    <Link
      key={id}
      href={`/dashboard/informes?panel=${id}`}
      aria-current={active === id ? "page" : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
        active === id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {label}
      {extra}
      {defaultId === id && <span className={active === id ? "text-slate-300" : "text-slate-400"} title="Se abre por defecto">★</span>}
    </Link>
  );
  return (
    <div className="mb-5">
      <nav aria-label="Paneles" className="flex flex-wrap items-center gap-1.5">
        {tab("general", "General")}
        {dashboards.map((d) => tab(d.id, d.name, d.shared ? <span className="text-xs opacity-70">· equipo</span> : null))}
        {!creating ? (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex h-8 items-center rounded-full border border-dashed border-slate-300 px-3.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900">
            + Nuevo panel
          </button>
        ) : (
          <form
            className="flex items-center gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const r = await api("/api/reports/dashboards", "POST", { name: name.trim(), widgets: [] });
              if (!r.ok) return setError(r.error);
              setCreating(false);
              setName("");
              startTransition(() => router.push(`/dashboard/informes?panel=${r.data.id}&edit=1`));
            }}
          >
            <Input aria-label="Nombre del panel" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ej: Colaboraciones" className="h-8 w-48" />
            <Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>
              Crear
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </nav>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

let wseq = 0;
const newId = () => `w${Date.now().toString(36)}${(wseq++).toString(36)}`;

export function DashboardPanel({
  dashboard,
  data,
  canEdit,
  canShare,
  isDefault,
  modules,
  members,
  startEditing = false,
}: {
  startEditing?: boolean;
  dashboard: { id: string; name: string; shared: boolean; widgets: Widget[] };
  data: Record<string, WidgetData>;
  canEdit: boolean;
  canShare: boolean;
  isDefault: boolean;
  modules: BuilderModule[];
  members: { userId: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(startEditing && canEdit);
  const [widgets, setWidgets] = useState<Widget[]>(dashboard.widgets);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [name, setName] = useState(dashboard.name);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => startTransition(() => router.refresh());

  async function persist(next: Widget[], extra: Record<string, unknown> = {}) {
    setError(null);
    const r = await api(`/api/reports/dashboards/${dashboard.id}`, "PATCH", { widgets: next, ...extra });
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setWidgets(next);
    refresh();
    return true;
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= widgets.length) return;
    const next = [...widgets];
    [next[i], next[j]] = [next[j], next[i]];
    void persist(next);
  }

  const spanClass = (size: number) => (size >= 3 ? "md:col-span-2 xl:col-span-3" : size === 2 ? "md:col-span-2" : "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await persist(widgets, { name })) toast.success("Panel renombrado");
            }}
          >
            <Input aria-label="Nombre del panel" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="h-9 w-56" />
            <Button type="submit" size="sm" variant="secondary" disabled={!name.trim() || name === dashboard.name}>
              Renombrar
            </Button>
          </form>
        ) : (
          <h2 className="text-lg font-semibold text-slate-900">{dashboard.name}</h2>
        )}
        {dashboard.shared && <Badge>Compartido</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={async () => {
              const r = await api("/api/preferences", "PUT", { key: "reports:default", value: isDefault ? null : dashboard.id });
              if (r.ok) {
                toast.success(isDefault ? "Se abrirá el panel General" : "Este panel se abrirá por defecto");
                refresh();
              }
            }}
          >
            {isDefault ? "★ Panel por defecto" : "☆ Abrir por defecto"}
          </Button>
          {canEdit && (
            <Button type="button" size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing(!editing)}>
              {editing ? "Listo" : "Editar panel"}
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <Button type="button" size="sm" onClick={() => setEditingWidget({ id: newId(), type: "metric", title: "Nuevo indicador", module: modules[0]?.entityType ?? "lead", metric: { op: "count" }, groupBy: null, dateField: "createdAt", period: "30", filters: { match: "all", conditions: [] }, columns: [], limit: 10, size: 1 })}>
            Agregar componente
          </Button>
          {canShare && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={dashboard.shared} onChange={(e) => void persist(widgets, { shared: e.target.checked })} />
              Compartir con el equipo (cada persona ve solo los datos que su permiso le permite)
            </label>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto text-red-600"
            onClick={async () => {
              if (!(await confirm({ title: `¿Borrar el panel “${dashboard.name}”?`, description: "Se borra su configuración. Los datos no se tocan.", tone: "danger" }))) return;
              const r = await api(`/api/reports/dashboards/${dashboard.id}`, "DELETE");
              if (!r.ok) return setError(r.error);
              toast.success("Panel borrado");
              startTransition(() => router.push("/dashboard/informes?panel=general"));
            }}
          >
            Borrar panel
          </Button>
        </Card>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {editingWidget && (
        <WidgetEditor
          widget={editingWidget}
          modules={modules}
          members={members}
          pending={pending}
          onCancel={() => setEditingWidget(null)}
          onSave={async (w) => {
            const exists = widgets.some((x) => x.id === w.id);
            if (await persist(exists ? widgets.map((x) => (x.id === w.id ? w : x)) : [...widgets, w])) setEditingWidget(null);
          }}
        />
      )}

      {widgets.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Este panel está vacío. {canEdit ? "Tocá «Editar panel» → «Agregar componente» para sumar indicadores, gráficos o tablas de cualquier módulo." : ""}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((w, i) => (
            <Card key={w.id} className={`flex flex-col p-4 ${spanClass(w.size)}`}>
              <div className="mb-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{w.title}</h3>
                  <p className="truncate text-xs text-slate-500">
                    {modules.find((m) => m.entityType === w.module)?.plural ?? "Módulo"} · {PERIOD_LABELS[w.period]}
                    {w.filters.conditions.length ? ` · ${w.filters.conditions.length} ${w.filters.conditions.length === 1 ? "filtro" : "filtros"}` : ""}
                  </p>
                </div>
                {editing && (
                  <div className="flex shrink-0 gap-0.5">
                    <Button type="button" size="sm" variant="ghost" aria-label="Mover antes" disabled={i === 0} onClick={() => move(i, -1)}>
                      ◀
                    </Button>
                    <Button type="button" size="sm" variant="ghost" aria-label="Mover después" disabled={i === widgets.length - 1} onClick={() => move(i, 1)}>
                      ▶
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingWidget(w)}>
                      Editar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => void persist(widgets.filter((x) => x.id !== w.id))}>
                      Quitar
                    </Button>
                  </div>
                )}
              </div>
              <WidgetBody data={data[w.id]} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetBody({ data }: { data: WidgetData | undefined }) {
  if (!data) return <p className="text-sm text-slate-400">Guardando… los datos aparecen al actualizar.</p>;
  if (data.kind === "denied" || data.kind === "error") return <p className="text-sm text-slate-500">{data.message}</p>;
  const truncated = "truncated" in data && data.truncated && <p className="mt-2 text-xs text-amber-700">Calculado sobre los 20.000 registros más recientes.</p>;
  if (data.kind === "metric") {
    return (
      <div>
        <p className="text-[32px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-slate-900">{data.display}</p>
        <p className="text-xs text-slate-500">
          {data.count} {data.count === 1 ? "registro" : "registros"}
        </p>
        {truncated}
      </div>
    );
  }
  if (data.kind === "bar") {
    return (
      <>
        <HBars rows={data.rows.map((r) => ({ label: r.label, value: r.value, hint: r.display !== String(r.value) ? r.display : undefined }))} valueLabel={(n) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} />
        {truncated}
      </>
    );
  }
  if (data.kind === "line") {
    const max = Math.max(1, ...data.points.map((p) => p.value));
    const step = Math.ceil(data.points.length / 8);
    return (
      <figure>
        <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={data.points.map((p) => `${p.label}: ${p.value}`).join(", ")}>
          {data.points.map((p) => (
            <div key={p.key} className="group flex h-full flex-1 items-end" title={`${p.label}: ${p.value.toLocaleString("es-AR")}`}>
              <div className="w-full rounded-t-[4px] bg-brand-500 opacity-90 group-hover:opacity-100" style={{ height: p.value === 0 ? 2 : `${(p.value / max) * 100}%`, opacity: p.value === 0 ? 0.25 : undefined }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-[2px] border-t border-slate-200 pt-1 text-[10px] tabular-nums text-slate-500">
          {data.points.map((p, i) => (
            <span key={p.key} className="flex-1 truncate text-center">
              {i % step === 0 ? p.label : ""}
            </span>
          ))}
        </div>
        {truncated}
      </figure>
    );
  }
  return (
    <div className="overflow-x-auto">
      {data.rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Sin registros.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              {data.columns.map((c) => (
                <th key={c} className="pb-2 pr-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {r.cells.map((c, i) => (
                  <td key={i} className="max-w-[16rem] truncate py-1.5 pr-3 text-slate-700">
                    {i === 0 && r.href ? (
                      <Link href={r.href} className="font-medium text-slate-900 hover:underline">
                        {c}
                      </Link>
                    ) : (
                      c
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs text-slate-500">{data.total} en total</p>
      {truncated}
    </div>
  );
}

function WidgetEditor({
  widget,
  modules,
  members,
  pending,
  onCancel,
  onSave,
}: {
  widget: Widget;
  modules: BuilderModule[];
  members: { userId: string; name: string; role: string }[];
  pending: boolean;
  onCancel: () => void;
  onSave: (w: Widget) => void;
}) {
  const [w, setW] = useState<Widget>(widget);
  const mod = modules.find((m) => m.entityType === w.module);
  const fields = mod?.fields ?? [];
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const numeric = fields.filter((f) => NUMERIC_KINDS.has(f.type));
  const dates = fields.filter((f) => DATE_KINDS.has(f.type));
  const groupable = fields.filter((f) => GROUPABLE_KINDS.has(f.type));
  const set = (patch: Partial<Widget>) => setW({ ...w, ...patch });
  const invalid = !w.title.trim() || (w.type === "bar" && !w.groupBy) || (w.metric.op !== "count" && !w.metric.field);

  return (
    <Card className="space-y-4 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Label htmlFor="wd-title">Título</Label>
          <Input id="wd-title" value={w.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="wd-type">Tipo</Label>
          <Select id="wd-type" value={w.type} onChange={(e) => set({ type: e.target.value as Widget["type"], groupBy: e.target.value === "bar" ? (groupable[0]?.key ?? null) : w.groupBy })}>
            {WIDGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {WIDGET_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="wd-module">Módulo</Label>
          <Select
            id="wd-module"
            value={w.module}
            onChange={(e) => set({ module: e.target.value, metric: { op: "count" }, groupBy: null, dateField: "createdAt", filters: { match: "all", conditions: [] }, columns: [] })}
          >
            {modules.map((m) => (
              <option key={m.entityType} value={m.entityType}>
                {m.plural}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="wd-size">Ancho</Label>
          <Select id="wd-size" value={w.size} onChange={(e) => set({ size: Number(e.target.value) })}>
            <option value={1}>Normal</option>
            <option value={2}>Doble</option>
            <option value={3}>Ancho completo</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {w.type !== "table" && (
          <>
            <div>
              <Label htmlFor="wd-op">Medir</Label>
              <Select id="wd-op" value={w.metric.op} onChange={(e) => set({ metric: { op: e.target.value as Widget["metric"]["op"], field: e.target.value === "count" ? null : (numeric[0]?.key ?? null) } })}>
                <option value="count">Cantidad de registros</option>
                <option value="sum" disabled={!numeric.length}>
                  Suma de un campo
                </option>
                <option value="avg" disabled={!numeric.length}>
                  Promedio de un campo
                </option>
              </Select>
            </div>
            {w.metric.op !== "count" && (
              <div>
                <Label htmlFor="wd-field">Campo numérico</Label>
                <Select id="wd-field" value={w.metric.field ?? ""} onChange={(e) => set({ metric: { ...w.metric, field: e.target.value } })}>
                  {numeric.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </>
        )}
        {w.type === "bar" && (
          <div>
            <Label htmlFor="wd-group">Agrupar por</Label>
            <Select id="wd-group" value={w.groupBy ?? ""} onChange={(e) => set({ groupBy: e.target.value })}>
              {groupable.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="wd-date">Fecha de referencia</Label>
          <Select id="wd-date" value={w.dateField} onChange={(e) => set({ dateField: e.target.value })}>
            {dates.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="wd-period">Período</Label>
          <Select id="wd-period" value={w.period} onChange={(e) => set({ period: e.target.value as Widget["period"] })}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
        {(w.type === "bar" || w.type === "table") && (
          <div>
            <Label htmlFor="wd-limit">{w.type === "bar" ? "Máximo de barras" : "Filas"}</Label>
            <Input id="wd-limit" type="number" min={1} max={50} value={w.limit} onChange={(e) => set({ limit: Math.max(1, Math.min(50, Number(e.target.value) || 10)) })} />
          </div>
        )}
      </div>

      {w.type === "table" && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Columnas (la primera enlaza al registro)</p>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f) => {
              const on = w.columns.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && w.columns.length >= 8}
                  onClick={() => set({ columns: on ? w.columns.filter((c) => c !== f.key) : [...w.columns, f.key] })}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:opacity-40 ${on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200"}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">Filtros</p>
          <MatchToggle value={w.filters.match} onChange={(match) => set({ filters: { ...w.filters, match } })} />
        </div>
        <ConditionList
          items={w.filters.conditions}
          fields={fields}
          fieldMap={fieldMap}
          meta={{ modules, related: {}, members }}
          allowChange={false}
          allowGroups
          onChange={(conditions) => set({ filters: { ...w.filters, conditions } })}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" loading={pending} disabled={invalid} onClick={() => onSave({ ...w, title: w.title.trim() })}>
          Guardar componente
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
