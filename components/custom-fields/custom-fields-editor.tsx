"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { BOOLEAN_TRUE, BOOLEAN_FALSE, toIsoDate } from "@/lib/custom-fields";

interface FieldWithValue {
  definitionId: string;
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  value: string | null;
}

// Valor guardado (forma canónica, o el texto crudo de datos viejos) → lo
// que espera cada input. Así un "15/03/2026" importado antes de normalizar
// igual aparece en el selector de fecha.
function toInputValue(type: string, value: string | null): string {
  if (!value) return "";
  if (type === "date") return toIsoDate(value) ?? value;
  if (type === "datetime") {
    const date = toIsoDate(value.split(/[T ]/)[0] ?? "");
    const time = value.match(/[T ](\d{1,2}):(\d{2})/);
    return date ? `${date}T${time ? `${time[1].padStart(2, "0")}:${time[2]}` : "00:00"}` : value;
  }
  if (type === "boolean") {
    const v = value.toLowerCase();
    return BOOLEAN_TRUE.has(v) ? "true" : BOOLEAN_FALSE.has(v) ? "false" : "";
  }
  return value;
}

const INPUT_TYPE: Record<string, string> = {
  number: "number",
  currency: "number",
  date: "date",
  datetime: "datetime-local",
  email: "email",
  phone: "tel",
  url: "url",
};

export function CustomFieldsEditor({ entityId, fields }: { entityId: string; fields: FieldWithValue[] }) {
  const router = useRouter();
  const initial = Object.fromEntries(fields.map((f) => [f.definitionId, toInputValue(f.type, f.value)]));
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(definitionId: string) {
    setSaving(definitionId);
    setErrors((e) => ({ ...e, [definitionId]: "" }));
    const res = await fetch("/api/custom-field-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId, entityId, value: values[definitionId] || null }),
    });
    setSaving(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrors((e) => ({ ...e, [definitionId]: body.message ?? "No se pudo guardar. Intentá de nuevo." }));
      return;
    }
    setSaved((s) => ({ ...s, [definitionId]: values[definitionId] ?? "" }));
    router.refresh();
  }

  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      {fields.map((f) => {
        const value = values[f.definitionId] ?? "";
        const dirty = value !== (saved[f.definitionId] ?? "");
        const set = (v: string) => setValues((prev) => ({ ...prev, [f.definitionId]: v }));
        const id = `cf-${f.definitionId}`;
        const options = f.options ?? [];
        const selected = value ? value.split(",").map((p) => p.trim()).filter(Boolean) : [];

        let control;
        if (f.type === "boolean") {
          control = (
            <Select id={id} value={value} onChange={(e) => set(e.target.value)}>
              <option value="">—</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Select>
          );
        } else if (f.type === "select" && options.length > 0) {
          control = (
            <Select id={id} value={value} onChange={(e) => set(e.target.value)}>
              <option value="">—</option>
              {/* Un valor viejo que ya no está entre las opciones se sigue viendo. */}
              {value && !options.includes(value) && <option value={value}>{value}</option>}
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          );
        } else if (f.type === "multiselect" && options.length > 0) {
          control = (
            <div id={id} role="group" aria-label={f.label} className="flex flex-wrap gap-1.5 pt-0.5">
              {options.map((o) => {
                const on = selected.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set((on ? selected.filter((s) => s !== o) : [...selected, o]).join(", "))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                      on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          );
        } else {
          control = (
            <Input
              id={id}
              type={INPUT_TYPE[f.type] ?? "text"}
              step={f.type === "number" || f.type === "currency" ? "any" : undefined}
              value={value}
              onChange={(e) => set(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty) {
                  e.preventDefault();
                  void save(f.definitionId);
                }
              }}
            />
          );
        }

        return (
          <div key={f.definitionId}>
            <Label htmlFor={id}>
              {f.label}
              {f.required ? " *" : ""}
            </Label>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{control}</div>
              {dirty && (
                <Button type="button" variant="secondary" onClick={() => save(f.definitionId)} disabled={saving === f.definitionId}>
                  {saving === f.definitionId ? "Guardando…" : "Guardar"}
                </Button>
              )}
            </div>
            {errors[f.definitionId] && <p className="mt-1 text-xs text-red-600">{errors[f.definitionId]}</p>}
          </div>
        );
      })}
    </div>
  );
}
