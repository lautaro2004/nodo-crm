"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, InlineAlert, Input, Label, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/status/status-badge";
import { ColorSelect, ColorSwatches } from "@/components/status/color-picker";
import { RELATED_TYPE_LABELS } from "@/lib/labels";
import { readApiError } from "@/lib/error-messages";
import type { StatusColorKey } from "@/lib/status-colors";

interface StatusDef {
  id: string;
  entityType: string;
  key: string;
  label: string;
  color: string | null;
  order: number;
  requiresReason?: boolean;
  reasonOptions?: string[];
  isRejection?: boolean;
}

const ENTITY_TYPES = ["lead", "company"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

// Estados reservados por el sistema: se pueden renombrar y recolorear,
// pero no tiene sentido borrarlos (los escribe la propia app).
const SYSTEM_KEYS: Record<EntityType, string[]> = { lead: ["new", "converted"], company: ["archived"] };

function slugify(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "e_$1");
}

export function StatusDefinitionsManager({ statuses }: { statuses: StatusDef[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<EntityType>("lead");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<StatusColorKey>("sky");
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [rulesOpen, setRulesOpen] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setError(null);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    if (!res.ok) {
      setError(await readApiError(res));
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function createStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const ok = await call("/api/status-definitions", {
      method: "POST",
      body: JSON.stringify({ entityType, key: slugify(label) || `estado_${Date.now()}`, label: label.trim(), color }),
    });
    if (ok) setLabel("");
  }

  async function saveLabel(id: string) {
    if (!editing || !editing.label.trim()) return setEditing(null);
    const ok = await call(`/api/status-definitions/${id}`, { method: "PATCH", body: JSON.stringify({ label: editing.label.trim() }) });
    if (ok) setEditing(null);
  }

  function deleteStatus(s: StatusDef) {
    if (!window.confirm(`¿Borrar el estado “${s.label}”? Esta acción no se puede deshacer.`)) return;
    call(`/api/status-definitions/${s.id}`, { method: "DELETE" });
  }

  function move(items: StatusDef[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    call("/api/status-definitions", { method: "PATCH", body: JSON.stringify({ entityType: items[0].entityType, ids }) });
  }

  return (
    <div className="space-y-6">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Nuevo estado</h2>
        <p className="mt-1 text-xs text-slate-500">
          Los estados de Oportunidades son las etapas de cada pipeline (Oportunidades → Gestionar pipelines). Acá se configuran los de
          Leads y Empresas.
        </p>
        <form onSubmit={createStatus} className="mt-4 grid gap-4 md:grid-cols-[10rem_1fr_auto] md:items-end">
          <div>
            <Label htmlFor="status-entity">Módulo</Label>
            <Select id="status-entity" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RELATED_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status-label">Nombre</Label>
            <Input id="status-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: En negociación" maxLength={80} />
          </div>
          <Button type="submit" disabled={pending || !label.trim()}>
            Crear estado
          </Button>
          <div className="md:col-span-3">
            <p className="mb-2 text-[13px] font-medium text-slate-700">Color</p>
            <div className="flex flex-wrap items-center gap-4">
              <ColorSwatches name="new-status-color" value={color} onChange={setColor} />
              <span className="text-xs text-slate-500">Vista previa:</span>
              <StatusBadge label={label.trim() || "Nuevo estado"} color={color} />
            </div>
          </div>
        </form>
      </Card>

      {ENTITY_TYPES.map((t) => {
        const items = statuses.filter((s) => s.entityType === t).sort((a, b) => a.order - b.order);
        return (
          <Card key={t} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Estados de {RELATED_TYPE_LABELS[t]}</h2>
              <span className="text-xs text-slate-400">{items.length} estados · el orden define las columnas del Kanban</span>
            </div>
            {items.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">Sin estados configurados.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((s, index) => {
                  const isSystem = SYSTEM_KEYS[t].includes(s.key);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={`Subir ${s.label}`}
                          disabled={index === 0 || pending}
                          onClick={() => move(items, index, -1)}
                          className="h-4 text-[10px] leading-none text-slate-400 hover:text-slate-900 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${s.label}`}
                          disabled={index === items.length - 1 || pending}
                          onClick={() => move(items, index, 1)}
                          className="h-4 text-[10px] leading-none text-slate-400 hover:text-slate-900 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        {editing?.id === s.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveLabel(s.id);
                            }}
                            className="flex max-w-sm gap-2"
                          >
                            <Input
                              autoFocus
                              value={editing.label}
                              maxLength={80}
                              onChange={(e) => setEditing({ id: s.id, label: e.target.value })}
                              onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                              className="h-8 py-1"
                            />
                            <Button type="submit" size="sm" disabled={pending}>
                              Guardar
                            </Button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditing({ id: s.id, label: s.label })}
                            className="group inline-flex items-center gap-2 text-left"
                            title="Renombrar"
                          >
                            <StatusBadge label={s.label} color={s.color} />
                            <span className="text-xs text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">Renombrar</span>
                          </button>
                        )}
                      </div>

                      {isSystem && <span className="text-[11px] text-slate-400">Del sistema</span>}

                      <ColorSelect
                        id={s.id}
                        value={s.color}
                        disabled={pending}
                        onChange={(next) => call(`/api/status-definitions/${s.id}`, { method: "PATCH", body: JSON.stringify({ color: next }) })}
                      />

                      {t === "lead" && s.key !== "converted" && (
                        <Button type="button" variant="ghost" size="sm" aria-expanded={rulesOpen === s.id} onClick={() => setRulesOpen(rulesOpen === s.id ? null : s.id)}>
                          Reglas{s.requiresReason ? " · motivo" : ""}
                          {s.isRejection ? " · rechazo" : ""}
                        </Button>
                      )}

                      {!isSystem && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteStatus(s)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                          Borrar
                        </Button>
                      )}

                      {rulesOpen === s.id && (
                        <StatusRules
                          status={s}
                          pending={pending}
                          onSave={async (rules) => {
                            const ok = await call(`/api/status-definitions/${s.id}`, { method: "PATCH", body: JSON.stringify(rules) });
                            if (ok) setRulesOpen(null);
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Reglas de transición de un estado de Lead: estado de rechazo (para
// informes y métricas de "abiertos") y motivo obligatorio con opciones.
function StatusRules({
  status,
  pending,
  onSave,
}: {
  status: StatusDef;
  pending: boolean;
  onSave: (rules: { isRejection: boolean; requiresReason: boolean; reasonOptions: string[] }) => void;
}) {
  const [isRejection, setIsRejection] = useState(!!status.isRejection);
  const [requiresReason, setRequiresReason] = useState(!!status.requiresReason);
  const [options, setOptions] = useState((status.reasonOptions ?? []).join("\n"));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          isRejection,
          requiresReason,
          reasonOptions: options
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 20),
        });
      }}
      className="mt-1 w-full space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm"
    >
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={isRejection} onChange={(e) => setIsRejection(e.target.checked)} />
        <span>
          <span className="font-medium text-slate-800">Es un estado de rechazo / descarte</span>
          <span className="block text-xs text-slate-500">Cuenta como “rechazado” en informes y deja de contarse como lead abierto.</span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={requiresReason} onChange={(e) => setRequiresReason(e.target.checked)} />
        <span>
          <span className="font-medium text-slate-800">Exigir motivo al pasar a este estado</span>
          <span className="block text-xs text-slate-500">Se valida en el servidor: aplica desde la ficha, el Kanban y la API.</span>
        </span>
      </label>
      {requiresReason && (
        <div>
          <Label htmlFor={`reasons-${status.id}`}>Motivos posibles (uno por línea; vacío = texto libre)</Label>
          <textarea
            id={`reasons-${status.id}`}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            rows={4}
            placeholder={"Precio\nSin respuesta\nEligió a la competencia"}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          Guardar reglas
        </Button>
      </div>
    </form>
  );
}
