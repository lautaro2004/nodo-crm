"use client";

import { Input, Select } from "@/components/ui/primitives";
import { BOOLEAN_TRUE, BOOLEAN_FALSE, toIsoDate } from "@/lib/custom-fields";

// Control de edición de UN campo personalizado según su tipo. Lo usan el
// bloque "Campos personalizados" de los módulos estándar y el formulario
// de registros de los módulos personalizados (relación e imagen tienen
// controles propios).

/**
 * Valor guardado (forma canónica, o el texto crudo de datos viejos) → lo
 * que espera cada input. Así un "15/03/2026" importado antes de normalizar
 * igual aparece en el selector de fecha.
 */
export function toInputValue(type: string, value: string | null | undefined): string {
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

export function FieldInput({
  id,
  label,
  type,
  options = [],
  value,
  onChange,
  onEnter,
  invalid,
}: {
  id: string;
  label: string;
  type: string;
  options?: string[];
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  invalid?: boolean;
}) {
  const selected = value ? value.split(",").map((p) => p.trim()).filter(Boolean) : [];
  const aria = invalid ? { "aria-invalid": true as const } : {};

  if (type === "boolean") {
    return (
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...aria}>
        <option value="">—</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </Select>
    );
  }
  if (type === "select" && options.length > 0) {
    return (
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...aria}>
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
  }
  if (type === "multiselect" && options.length > 0) {
    return (
      <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-1.5 pt-0.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange((on ? selected.filter((s) => s !== o) : [...selected, o]).join(", "))}
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
  }
  return (
    <Input
      id={id}
      type={INPUT_TYPE[type] ?? "text"}
      step={type === "number" || type === "currency" ? "any" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      {...aria}
    />
  );
}
