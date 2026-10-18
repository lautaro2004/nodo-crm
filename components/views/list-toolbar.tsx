"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Button, Input, Select, Spinner } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/popover";
import { BookmarkIcon, ColumnsIcon, DownloadIcon, FilterIcon, KanbanIcon, ListIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { readApiError } from "@/lib/error-messages";
import { normalizeViewParams, type ViewPreset } from "@/lib/views/presets";
import type { ColumnDef } from "@/lib/views/columns";
import { formatCustomValue } from "@/lib/custom-fields";

export interface Option {
  value: string;
  label: string;
}
export interface CustomFieldOption {
  id: string;
  label: string;
  type?: string;
  options: string[];
}
export interface SavedViewItem {
  id: string;
  name: string;
  params: string;
  shared: boolean;
  canEdit: boolean;
}

export interface FilterConfig {
  statuses?: Option[];
  owners: Option[];
  sources?: Option[];
  tags?: Option[];
  customFields?: CustomFieldOption[];
  dateFields: Option[];
  /** Leads: "Solo abiertos" + "Sin seguimiento". */
  followUp?: boolean;
  /** Oportunidades: "Estancadas" + monto mínimo. */
  pipelineExtras?: boolean;
}

// Barra de lista compartida por Leads y Oportunidades: búsqueda, vistas
// (predefinidas, personales y compartidas), filtros combinados, columnas,
// orden, exportación CSV y Lista/Kanban.
//
// Todo el estado vive en la URL: la página (server component) relee con
// esos parámetros, la vista guardada guarda ese query string y el CSV lo
// recibe tal cual. Alternar Lista/Kanban conserva filtros y columnas.
export function ListToolbar({
  entity,
  searchPlaceholder,
  filters,
  columns,
  defaultColumns,
  sortOptions,
  presets,
  savedViews,
  canShare,
  display,
  defaultDisplay,
  exportPath,
}: {
  entity: "lead" | "opportunity";
  searchPlaceholder: string;
  filters: FilterConfig;
  columns: ColumnDef[];
  defaultColumns: string[];
  sortOptions: Option[];
  presets: ViewPreset[];
  savedViews: SavedViewItem[];
  canShare: boolean;
  display: "list" | "kanban";
  defaultDisplay: "list" | "kanban";
  exportPath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }
  function setParams(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    push(next);
  }

  const currentNormalized = normalizeViewParams(sp);
  const activeViewId = sp.get("view");
  const activeView = savedViews.find((v) => v.id === activeViewId) ?? presets.find((p) => p.id === activeViewId);
  const viewDirty = !!activeView && normalizeViewParams(activeView.params) !== currentNormalized;

  const chips = buildChips(sp, filters);
  const visibleCols = (sp.get("cols") ?? defaultColumns.join(",")).split(",");

  function displayHref(d: "list" | "kanban") {
    const next = new URLSearchParams(sp.toString());
    if (d === defaultDisplay) next.delete("display");
    else next.set("display", d);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const exportQs = new URLSearchParams(sp.toString());
  exportQs.delete("view");

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: q.trim() || undefined });
          }}
          className="relative min-w-[14rem] flex-1"
        >
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {pending ? <Spinner className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
          </span>
          <Input
            type="search"
            aria-label="Buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => (q.trim() || undefined) !== (sp.get("q") ?? undefined) && setParams({ q: q.trim() || undefined })}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </form>

        <ViewsMenu
          entity={entity}
          presets={presets}
          savedViews={savedViews}
          canShare={canShare}
          activeView={activeView}
          viewDirty={viewDirty}
          currentParams={currentNormalized}
          onSaved={(id) => {
            const next = new URLSearchParams(sp.toString());
            next.set("view", id);
            push(next);
          }}
        />

        <Popover label="Filtros" icon={<FilterIcon className="h-4 w-4" />} badge={chips.length} width="w-[22rem]">
          {(close) => (
            <FilterPanel
              key={sp.toString()}
              config={filters}
              sp={sp}
              onApply={(changes) => {
                setParams(changes);
                close();
              }}
            />
          )}
        </Popover>

        {display === "list" && (
          <>
            <Popover label="Columnas" icon={<ColumnsIcon className="h-4 w-4" />} align="right" width="w-72">
              <ColumnPicker
                columns={columns}
                visible={visibleCols}
                onChange={(cols) => setParams({ cols: cols.join(",") === defaultColumns.join(",") ? undefined : cols.join(",") })}
              />
            </Popover>
            <Select
              aria-label="Ordenar"
              value={sp.get("sort") ?? ""}
              onChange={(e) => setParams({ sort: e.target.value || undefined })}
              className="w-auto min-w-40"
            >
              {sortOptions.map((o, i) => (
                <option key={o.value} value={i === 0 ? "" : o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </>
        )}

        <a
          href={`${exportPath}?${exportQs.toString()}`}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] hover:border-slate-300"
          title="Exportar CSV con los filtros actuales"
        >
          <DownloadIcon className="h-4 w-4" />
          <span className="hidden sm:inline">CSV</span>
        </a>

        <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5" role="group" aria-label="Vista">
          {(["list", "kanban"] as const).map((d) => (
            <Link
              key={d}
              href={displayHref(d)}
              aria-current={display === d ? "page" : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium transition-colors ${
                display === d ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(32_33_36/0.08),0_0_0_1px_rgb(32_33_36/0.04)]" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {d === "list" ? <ListIcon className="h-4 w-4" /> : <KanbanIcon className="h-4 w-4" />}
              {d === "list" ? "Lista" : "Kanban"}
            </Link>
          ))}
        </div>
      </div>

      {(chips.length > 0 || activeView) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeView && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
              <BookmarkIcon className="h-3 w-3" />
              {activeView.name}
              {viewDirty && <span className="text-slate-300">· modificada</span>}
            </span>
          )}
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setParams(Object.fromEntries(chip.params.map((p) => [p, undefined])))}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-slate-300"
              aria-label={`Quitar filtro ${chip.label}`}
            >
              {chip.label}
              <XIcon className="h-3 w-3 text-slate-400" />
            </button>
          ))}
          {chips.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams();
                for (const k of ["display", "cols", "sort", "pipelineId"]) {
                  const v = sp.get(k);
                  if (v) next.set(k, v);
                }
                setQ("");
                push(next);
              }}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chips de filtros activos ────────────────────────────────────────────

function buildChips(sp: URLSearchParams, f: FilterConfig): { key: string; label: string; params: string[] }[] {
  const label = (opts: Option[] | undefined, v: string) => opts?.find((o) => o.value === v)?.label ?? v;
  const chips: { key: string; label: string; params: string[] }[] = [];
  const q = sp.get("q");
  if (q) chips.push({ key: "q", label: `“${q}”`, params: ["q"] });
  const status = sp.get("status");
  if (status) chips.push({ key: "status", label: `Estado: ${status.split(",").map((s) => label(f.statuses, s)).join(", ")}`, params: ["status"] });
  const owner = sp.get("ownerId");
  if (owner) chips.push({ key: "owner", label: `Responsable: ${owner === "me" ? "Yo" : owner === "none" ? "Sin asignar" : label(f.owners, owner)}`, params: ["ownerId"] });
  const source = sp.get("source");
  if (source) chips.push({ key: "source", label: `Origen: ${source.split(",").map((s) => label(f.sources, s)).join(", ")}`, params: ["source"] });
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    const field = label(f.dateFields, sp.get("dateField") ?? f.dateFields[0]?.value ?? "");
    chips.push({ key: "date", label: `${field}: ${from ?? "…"} → ${to ?? "hoy"}`, params: ["from", "to", "dateField"] });
  }
  if (sp.get("open") === "1") chips.push({ key: "open", label: "Solo abiertos", params: ["open"] });
  const nf = sp.get("nofollowup");
  if (nf) chips.push({ key: "nf", label: nf === "0" ? "Nunca contactados" : `Sin seguimiento ≥ ${nf} días`, params: ["nofollowup"] });
  if (sp.get("stalled") === "1") chips.push({ key: "stalled", label: "Estancadas (+14 días)", params: ["stalled"] });
  const min = sp.get("minAmount");
  if (min) chips.push({ key: "min", label: `Valor ≥ $${Number(min).toLocaleString("es-AR")}`, params: ["minAmount"] });
  const tag = sp.get("tagId");
  if (tag) chips.push({ key: "tag", label: `Etiqueta: ${label(f.tags, tag)}`, params: ["tagId"] });
  for (const [k, v] of sp.entries()) {
    if (k.startsWith("cf.") && v) {
      const def = f.customFields?.find((c) => c.id === k.slice(3));
      chips.push({ key: k, label: `${def?.label ?? "Campo"}: ${def?.type ? formatCustomValue(def.type, v) || v : v}`, params: [k] });
    }
  }
  return chips;
}

// ── Panel de filtros ────────────────────────────────────────────────────

function FilterPanel({
  config,
  sp,
  onApply,
}: {
  config: FilterConfig;
  sp: URLSearchParams;
  onApply: (changes: Record<string, string | undefined>) => void;
}) {
  const [status, setStatus] = useState<string[]>(sp.get("status")?.split(",").filter(Boolean) ?? []);
  const [source, setSource] = useState<string[]>(sp.get("source")?.split(",").filter(Boolean) ?? []);
  const [owner, setOwner] = useState(sp.get("ownerId") ?? "");
  const [dateField, setDateField] = useState(sp.get("dateField") ?? config.dateFields[0]?.value ?? "created");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [open, setOpen] = useState(sp.get("open") === "1");
  const [nofollowup, setNofollowup] = useState(sp.get("nofollowup") ?? "");
  const [stalled, setStalled] = useState(sp.get("stalled") === "1");
  const [minAmount, setMinAmount] = useState(sp.get("minAmount") ?? "");
  const [tag, setTag] = useState(sp.get("tagId") ?? "");
  const [cf, setCf] = useState<Record<string, string>>(
    Object.fromEntries((config.customFields ?? []).map((c) => [c.id, sp.get(`cf.${c.id}`) ?? ""]))
  );

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function apply() {
    const changes: Record<string, string | undefined> = {
      status: status.join(",") || undefined,
      ownerId: owner || undefined,
      from: from || undefined,
      to: to || undefined,
      dateField: (from || to) && dateField !== config.dateFields[0]?.value ? dateField : undefined,
      tagId: tag || undefined,
      view: sp.get("view") ?? undefined,
    };
    if (config.sources) changes.source = source.join(",") || undefined;
    if (config.followUp) {
      changes.open = open ? "1" : undefined;
      changes.nofollowup = nofollowup !== "" ? String(Math.max(0, Number.parseInt(nofollowup, 10) || 0)) : undefined;
    }
    if (config.pipelineExtras) {
      changes.stalled = stalled ? "1" : undefined;
      changes.minAmount = minAmount ? String(Math.max(0, Number.parseInt(minAmount, 10) || 0)) : undefined;
    }
    for (const c of config.customFields ?? []) changes[`cf.${c.id}`] = cf[c.id]?.trim() || undefined;
    onApply(changes);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="space-y-4 text-sm"
    >
      {config.statuses && config.statuses.length > 0 && (
        <Field label="Estado">
          <div className="flex flex-wrap gap-1.5">
            {config.statuses.map((s) => (
              <Chip key={s.value} selected={status.includes(s.value)} onClick={() => setStatus(toggle(status, s.value))}>
                {s.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="Responsable">
        <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Todos</option>
          <option value="me">Yo</option>
          <option value="none">Sin asignar</option>
          {config.owners.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      {config.sources && (
        <Field label="Origen">
          <div className="flex flex-wrap gap-1.5">
            {config.sources.map((s) => (
              <Chip key={s.value} selected={source.includes(s.value)} onClick={() => setSource(toggle(source, s.value))}>
                {s.label}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="Período">
        <div className="grid grid-cols-2 gap-2">
          <Select value={dateField} onChange={(e) => setDateField(e.target.value)} className="col-span-2">
            {config.dateFields.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Field>

      {config.followUp && (
        <Field label="Seguimiento">
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={open} onChange={(e) => setOpen(e.target.checked)} />
            Solo abiertos (sin convertidos ni rechazados)
          </label>
          <label className="mt-2 flex items-center gap-2 text-slate-700">
            Sin seguimiento hace al menos
            <Input
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              value={nofollowup}
              onChange={(e) => setNofollowup(e.target.value)}
              className="w-16 px-2 py-1"
              aria-label="Días sin seguimiento"
            />
            días
          </label>
          <p className="mt-1 text-[11px] text-slate-500">Cuenta llamadas, emails, reuniones y notas registradas por una persona. 0 = nunca contactado.</p>
        </Field>
      )}

      {config.pipelineExtras && (
        <Field label="Oportunidad">
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={stalled} onChange={(e) => setStalled(e.target.checked)} />
            Estancadas (abiertas sin cambios en 14 días)
          </label>
          <label className="mt-2 flex items-center gap-2 text-slate-700">
            Valor mínimo $
            <Input type="number" min={0} inputMode="numeric" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-32 px-2 py-1" aria-label="Valor mínimo" />
          </label>
        </Field>
      )}

      {config.tags && config.tags.length > 0 && (
        <Field label="Etiqueta">
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Todas</option>
            {config.tags.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {(config.customFields ?? []).map((c) => (
        <Field key={c.id} label={c.label}>
          {c.type === "boolean" ? (
            <Select value={cf[c.id] ?? ""} onChange={(e) => setCf({ ...cf, [c.id]: e.target.value })}>
              <option value="">Cualquiera</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Select>
          ) : c.type === "date" ? (
            <Input type="date" value={cf[c.id] ?? ""} onChange={(e) => setCf({ ...cf, [c.id]: e.target.value })} />
          ) : c.options.length > 0 ? (
            <Select value={cf[c.id] ?? ""} onChange={(e) => setCf({ ...cf, [c.id]: e.target.value })}>
              <option value="">Cualquiera</option>
              {c.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={cf[c.id] ?? ""} onChange={(e) => setCf({ ...cf, [c.id]: e.target.value })} placeholder="Contiene…" />
          )}
        </Field>
      ))}

      <div className="flex justify-end gap-2 border-t border-slate-200/70 pt-3">
        <Button type="submit" size="sm">
          Aplicar filtros
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</legend>
      {children}
    </fieldset>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

// ── Columnas ────────────────────────────────────────────────────────────

function ColumnPicker({ columns, visible: initial, onChange: commit }: { columns: ColumnDef[]; visible: string[]; onChange: (cols: string[]) => void }) {
  // Estado local optimista: el checkbox responde al instante y la URL se
  // actualiza en segundo plano.
  const [visible, setVisible] = useState(initial);
  const onChange = (cols: string[]) => {
    setVisible(cols);
    commit(cols);
  };
  // Orden mostrado: primero las visibles (en su orden), después el resto.
  const ordered = [
    ...visible.map((k) => columns.find((c) => c.key === k)).filter((c): c is ColumnDef => !!c),
    ...columns.filter((c) => !visible.includes(c.key)),
  ];

  function move(key: string, dir: -1 | 1) {
    const i = visible.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visible.length) return;
    const lockedCount = columns.filter((c) => c.locked).length;
    if (j < lockedCount) return;
    const next = [...visible];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Columnas visibles</p>
      <ul className="space-y-0.5">
        {ordered.map((c) => {
          const on = visible.includes(c.key);
          const idx = visible.indexOf(c.key);
          return (
            <li key={c.key} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/70">
              <input
                id={`col-${c.key}`}
                type="checkbox"
                className="h-4 w-4 accent-brand-500"
                checked={on}
                disabled={c.locked}
                onChange={() => onChange(on ? visible.filter((k) => k !== c.key) : [...visible, c.key])}
              />
              <label htmlFor={`col-${c.key}`} className={`flex-1 text-sm ${on ? "text-slate-800" : "text-slate-500"}`}>
                {c.label}
              </label>
              {on && !c.locked && (
                <span className="flex">
                  <button type="button" aria-label={`Mover ${c.label} antes`} disabled={idx <= 1} onClick={() => move(c.key, -1)} className="px-1 text-xs text-slate-400 hover:text-slate-900 disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" aria-label={`Mover ${c.label} después`} disabled={idx === visible.length - 1} onClick={() => move(c.key, 1)} className="px-1 text-xs text-slate-400 hover:text-slate-900 disabled:opacity-30">
                    ▼
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Vistas ──────────────────────────────────────────────────────────────

function ViewsMenu({
  entity,
  presets,
  savedViews,
  canShare,
  activeView,
  viewDirty,
  currentParams,
  onSaved,
}: {
  entity: "lead" | "opportunity";
  presets: ViewPreset[];
  savedViews: SavedViewItem[];
  canShare: boolean;
  activeView: SavedViewItem | ViewPreset | undefined;
  viewDirty: boolean;
  currentParams: string;
  onSaved: (id: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editableActive = activeView && "canEdit" in activeView && activeView.canEdit ? activeView : null;
  const mine = savedViews.filter((v) => !v.shared);
  const sharedViews = savedViews.filter((v) => v.shared);

  async function request(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        setError(await readApiError(res));
        return null;
      }
      return res.json();
    } finally {
      setBusy(false);
    }
  }

  function href(params: string, id: string) {
    const sp = new URLSearchParams(params);
    sp.set("view", id);
    return `${pathname}?${sp.toString()}`;
  }

  return (
    <Popover label={activeView ? activeView.name : "Vistas"} icon={<BookmarkIcon className="h-4 w-4" />} active={!!activeView} width="w-80">
      {(close) => (
        <div className="space-y-3 text-sm">
          <ViewGroup title="Predefinidas">
            {presets.map((p) => (
              <ViewLink key={p.id} href={href(p.params, p.id)} onClick={close} active={activeView?.id === p.id} hint={p.hint}>
                {p.name}
              </ViewLink>
            ))}
          </ViewGroup>

          {mine.length > 0 && (
            <ViewGroup title="Mis vistas">
              {mine.map((v) => (
                <ViewRow key={v.id} view={v} href={href(v.params, v.id)} active={activeView?.id === v.id} onClick={close} onDelete={async () => {
                  if (!window.confirm(`¿Borrar la vista “${v.name}”?`)) return;
                  if (await request(`/api/views/${v.id}`, { method: "DELETE" })) router.refresh();
                }} />
              ))}
            </ViewGroup>
          )}

          {sharedViews.length > 0 && (
            <ViewGroup title="Compartidas con el equipo">
              {sharedViews.map((v) => (
                <ViewRow key={v.id} view={v} href={href(v.params, v.id)} active={activeView?.id === v.id} onClick={close} onDelete={async () => {
                  if (!window.confirm(`¿Borrar la vista compartida “${v.name}”? Deja de estar disponible para todo el equipo.`)) return;
                  if (await request(`/api/views/${v.id}`, { method: "DELETE" })) router.refresh();
                }} />
              ))}
            </ViewGroup>
          )}

          {error && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}

          {editableActive && viewDirty && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              className="w-full"
              onClick={async () => {
                if (await request(`/api/views/${editableActive.id}`, { method: "PATCH", body: JSON.stringify({ params: currentParams }) })) {
                  router.refresh();
                  close();
                }
              }}
            >
              Guardar cambios en “{editableActive.name}”
            </Button>
          )}

          <form
            className="space-y-2 border-t border-slate-200/70 pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const view = await request("/api/views", {
                method: "POST",
                body: JSON.stringify({ entityType: entity, name: name.trim(), params: currentParams, shared }),
              });
              if (view) {
                setName("");
                setShared(false);
                close();
                onSaved(view.id);
                router.refresh();
              }
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Guardar vista actual</p>
            <p className="text-[11px] text-slate-500">Guarda filtros, columnas, orden y Lista/Kanban.</p>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Leads de Instagram" maxLength={60} className="h-9 py-1" />
              <Button type="submit" size="sm" disabled={busy || !name.trim()}>
                Guardar
              </Button>
            </div>
            {canShare ? (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={shared} onChange={(e) => setShared(e.target.checked)} />
                Compartir con todo el equipo
              </label>
            ) : (
              <p className="text-[11px] text-slate-400">Solo dueños o administradores pueden compartir vistas.</p>
            )}
          </form>
        </div>
      )}
    </Popover>
  );
}

function ViewGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ViewLink({ href, active, hint, onClick, children }: { href: string; active?: boolean; hint?: string; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={`block rounded-lg px-2 py-1.5 ${active ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-white/80"}`}
      >
        <span className="block font-medium">{children}</span>
        {hint && <span className={`block text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>{hint}</span>}
      </Link>
    </li>
  );
}

function ViewRow({ view, href, active, onClick, onDelete }: { view: SavedViewItem; href: string; active: boolean; onClick: () => void; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-1">
      <Link href={href} onClick={onClick} className={`flex-1 rounded-lg px-2 py-1.5 font-medium ${active ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-white/80"}`}>
        {view.name}
      </Link>
      {view.canEdit && (
        <button type="button" onClick={onDelete} aria-label={`Borrar vista ${view.name}`} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
