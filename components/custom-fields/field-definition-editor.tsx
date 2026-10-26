"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { FieldInput, toInputValue } from "@/components/custom-fields/field-input";
import { DEFAULTABLE_TYPES, OPTION_TYPES, VALIDATION_KEYS_BY_TYPE, VALIDATION_LABELS, type FieldValidation } from "@/lib/custom-fields";
import { apiFetch } from "@/lib/api-fetch";
import { readApiError } from "@/lib/error-messages";
import { useToast } from "@/components/ui/toast";

export interface EditableField {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  description?: string | null;
  defaultValue?: string | null;
  validation?: FieldValidation | null;
  targetEntity: string | null;
  targetLabel?: string | null;
  multiple: boolean;
  exclusive?: boolean;
  inverseLabel?: string | null;
}

// Cardinalidad de un campo relación, en términos del usuario:
//   multiple (este registro → varios)  ×  exclusive (cada destino → uno solo)
export const CARDINALITIES = [
  { value: "many_to_one", label: "Muchos a uno", hint: "Cada registro apunta a uno; el destino puede tener varios (ej. varias colaboraciones por contacto).", multiple: false, exclusive: false },
  { value: "one_to_one", label: "Uno a uno", hint: "Cada registro apunta a uno, y ese destino no puede estar en otro.", multiple: false, exclusive: true },
  { value: "one_to_many", label: "Uno a muchos", hint: "Cada registro apunta a varios, y cada destino solo a este registro.", multiple: true, exclusive: true },
  { value: "many_to_many", label: "Muchos a muchos", hint: "Sin restricciones: varios en cada lado.", multiple: true, exclusive: false },
] as const;

export function cardinalityOf(multiple: boolean, exclusive: boolean) {
  return CARDINALITIES.find((c) => c.multiple === multiple && c.exclusive === exclusive)!.value;
}

interface OptionRow {
  key: string;
  /** Nombre original (null = opción nueva). */
  original: string | null;
  value: string;
}

type Strategy = { action: "keep" } | { action: "clear" } | { action: "replace"; replaceWith: string };

let seq = 0;
const rowKey = () => `o${++seq}`;

/**
 * Edición completa de un campo personalizado (cualquier módulo): nombre,
 * descripción, opciones (agregar, renombrar, quitar, reordenar),
 * predeterminado, obligatorio, validaciones y —en relaciones— cardinalidad
 * y título de la vista inversa. Nada se borra en silencio: si se quita una
 * opción que usan registros, el servidor responde 409 con el detalle y acá
 * se pide qué hacer con esos registros.
 */
export function FieldDefinitionEditor({ field, onDone }: { field: EditableField; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const hasOptions = OPTION_TYPES.has(field.type);
  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.description ?? "");
  const [required, setRequired] = useState(field.required);
  const [defaultValue, setDefaultValue] = useState(toInputValue(field.type, field.defaultValue ?? null));
  const [validation, setValidation] = useState<FieldValidation>(field.validation ?? {});
  const [rows, setRows] = useState<OptionRow[]>(field.options.map((o) => ({ key: rowKey(), original: o, value: o })));
  const [newOption, setNewOption] = useState("");
  const [cardinality, setCardinality] = useState(cardinalityOf(field.multiple, !!field.exclusive));
  const [inverseLabel, setInverseLabel] = useState(field.inverseLabel ?? "");
  const [usage, setUsage] = useState<Record<string, number> | null>(null);
  const [conflicts, setConflicts] = useState<{ option: string; count: number }[] | null>(null);
  const [strategies, setStrategies] = useState<Record<string, Strategy>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasOptions) return;
    let alive = true;
    void apiFetch(`/api/custom-field-definitions/${field.id}/usage`)
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => alive && u && setUsage(u.byOption));
    return () => {
      alive = false;
    };
  }, [field.id, hasOptions]);

  const options = rows.map((r) => r.value.trim()).filter(Boolean);
  const duplicate = options.find((o, i) => options.findIndex((x) => x.toLowerCase() === o.toLowerCase()) !== i);
  const validationKeys = VALIDATION_KEYS_BY_TYPE[field.type] ?? [];

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  }

  function addOption() {
    const v = newOption.trim();
    if (!v) return;
    if (options.some((o) => o.toLowerCase() === v.toLowerCase())) return setError(`“${v}” ya está en la lista.`);
    setRows([...rows, { key: rowKey(), original: null, value: v }]);
    setNewOption("");
    setError(null);
  }

  async function save(withStrategies?: Record<string, Strategy>) {
    if (saving) return;
    if (duplicate) return setError(`La opción “${duplicate}” está repetida.`);
    setSaving(true);
    setError(null);
    const card = CARDINALITIES.find((c) => c.value === cardinality)!;
    const renames = rows.filter((r) => r.original && r.value.trim() && r.value.trim() !== r.original).map((r) => ({ from: r.original!, to: r.value.trim() }));
    const res = await apiFetch(`/api/custom-field-definitions/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        description: description.trim() || null,
        ...(field.type !== "image" && field.type !== "file" ? { required } : {}),
        ...(DEFAULTABLE_TYPES.has(field.type) ? { defaultValue: defaultValue.trim() || null } : {}),
        ...(validationKeys.length ? { validation: Object.fromEntries(validationKeys.map((k) => [k, validation[k] ?? null])) } : {}),
        ...(hasOptions ? { options, optionRenames: renames, ...(withStrategies ? { removedOptions: withStrategies } : {}) } : {}),
        ...(field.type === "relation" ? { multiple: card.multiple, exclusive: card.exclusive, inverseLabel: inverseLabel.trim() || null } : {}),
      }),
    });
    setSaving(false);
    if (res.status === 409) {
      const body = await res.clone().json().catch(() => ({}));
      if (body.error === "option_in_use") {
        setConflicts(body.usage);
        setStrategies(Object.fromEntries((body.usage as { option: string }[]).map((u) => [u.option, { action: "keep" } as Strategy])));
        return;
      }
    }
    if (!res.ok) return setError(await readApiError(res));
    toast.success("Campo actualizado");
    onDone();
    router.refresh();
  }

  const numberValidation = (k: keyof FieldValidation) => (
    <div key={k}>
      <Label htmlFor={`v-${field.id}-${k}`}>{VALIDATION_LABELS[k]}</Label>
      <Input
        id={`v-${field.id}-${k}`}
        type={k === "minDate" || k === "maxDate" ? "date" : "number"}
        step="any"
        value={validation[k] === null || validation[k] === undefined ? "" : String(validation[k])}
        onChange={(e) =>
          setValidation((v) => ({
            ...v,
            [k]: e.target.value === "" ? null : k === "minDate" || k === "maxDate" ? e.target.value : Number(e.target.value),
          }))
        }
      />
    </div>
  );

  if (conflicts) {
    return (
      <div className="mt-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-900">Hay registros que usan las opciones que quitaste. ¿Qué hacemos con ellos?</p>
        {conflicts.map((c) => {
          const s = strategies[c.option];
          return (
            <div key={c.option} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <span>
                “{c.option}” — {c.count} {c.count === 1 ? "registro" : "registros"}
              </span>
              <Select
                aria-label={`Qué hacer con ${c.option}`}
                value={s?.action ?? "keep"}
                onChange={(e) => {
                  const action = e.target.value as Strategy["action"];
                  setStrategies((p) => ({ ...p, [c.option]: action === "replace" ? { action, replaceWith: options[0] ?? "" } : { action } }));
                }}
              >
                <option value="keep">Conservar el valor histórico</option>
                <option value="replace" disabled={options.length === 0}>
                  Reemplazar por otra opción
                </option>
                <option value="clear">Vaciar el campo</option>
              </Select>
              {s?.action === "replace" ? (
                <Select aria-label="Reemplazar por" value={s.replaceWith} onChange={(e) => setStrategies((p) => ({ ...p, [c.option]: { action: "replace", replaceWith: e.target.value } }))}>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <span />
              )}
            </div>
          );
        })}
        <p className="text-xs text-amber-800">«Conservar» deja el valor en los registros aunque ya no sea una opción (se sigue viendo y filtrando). Nada se borra sin tu confirmación.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => save(strategies)} loading={saving}>
            Aplicar y guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConflicts(null)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`ef-label-${field.id}`}>Nombre</Label>
          <Input id={`ef-label-${field.id}`} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`ef-desc-${field.id}`}>Descripción (ayuda en el formulario)</Label>
          <Input id={`ef-desc-${field.id}`} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      {hasOptions && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Opciones</p>
          <ul className="space-y-1">
            {rows.map((r, i) => {
              const used = r.original ? (usage?.[r.original] ?? 0) : 0;
              return (
                <li key={r.key} className="flex items-center gap-1.5">
                  <div className="flex flex-col">
                    <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-[10px] leading-none text-slate-400 hover:text-slate-900 disabled:opacity-30">
                      ▲
                    </button>
                    <button type="button" aria-label="Bajar" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="px-1 text-[10px] leading-none text-slate-400 hover:text-slate-900 disabled:opacity-30">
                      ▼
                    </button>
                  </div>
                  <Input aria-label={`Opción ${i + 1}`} value={r.value} maxLength={80} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, value: e.target.value } : x)))} className="h-9" />
                  <span className="w-24 shrink-0 text-right text-xs text-slate-500">{r.original ? `${used} ${used === 1 ? "registro" : "registros"}` : "nueva"}</span>
                  <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="shrink-0 px-1 text-xs text-red-400 hover:text-red-600" aria-label={`Quitar ${r.value}`}>
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input
              aria-label="Nueva opción"
              value={newOption}
              maxLength={80}
              placeholder="Nueva opción"
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
              className="h-9"
            />
            <Button type="button" size="sm" variant="secondary" onClick={addOption} disabled={!newOption.trim()}>
              Agregar
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Renombrar una opción actualiza los registros que la tienen. Si quitás una en uso, te preguntamos qué hacer con esos registros.</p>
        </div>
      )}

      {DEFAULTABLE_TYPES.has(field.type) && (
        <div className="max-w-sm">
          <Label htmlFor={`ef-def-${field.id}`}>Valor predeterminado</Label>
          <FieldInput id={`ef-def-${field.id}`} label="Valor predeterminado" type={field.type} options={options} value={defaultValue} onChange={setDefaultValue} />
          <p className="mt-1 text-xs text-slate-500">Se completa solo al crear un registro. Vacío = sin valor.</p>
        </div>
      )}

      {validationKeys.length > 0 && <div className="grid grid-cols-2 gap-2 sm:max-w-md">{validationKeys.map(numberValidation)}</div>}

      {field.type === "relation" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor={`ef-card-${field.id}`}>Tipo de relación{field.targetLabel ? ` con ${field.targetLabel}` : ""}</Label>
            <Select id={`ef-card-${field.id}`} value={cardinality} onChange={(e) => setCardinality(e.target.value as typeof cardinality)}>
              {CARDINALITIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">{CARDINALITIES.find((c) => c.value === cardinality)!.hint}</p>
          </div>
          <div>
            <Label htmlFor={`ef-inv-${field.id}`}>Título en el registro relacionado</Label>
            <Input id={`ef-inv-${field.id}`} value={inverseLabel} maxLength={80} onChange={(e) => setInverseLabel(e.target.value)} placeholder="Ej: Colaboraciones" />
          </div>
        </div>
      )}

      {field.type !== "image" && field.type !== "file" && (
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Obligatorio
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => save()} disabled={!label.trim()} loading={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
