"use client";

import { useState } from "react";

import { Label } from "@/components/ui/primitives";
import { FieldInput, toInputValue } from "@/components/custom-fields/field-input";
import { RecordPicker, type PickedRecord } from "@/components/custom-modules/record-picker";

export interface FormCustomField {
  definitionId: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  description?: string | null;
  defaultValue?: string | null;
  targetEntity?: string | null;
  multiple?: boolean;
}

/** Valores iniciales de un alta: los predeterminados de cada campo. */
export function initialCustomValues(fields: FormCustomField[] | undefined): Record<string, string> {
  return Object.fromEntries((fields ?? []).filter((f) => f.type !== "image" && f.type !== "file").map((f) => [f.definitionId, toInputValue(f.type, f.defaultValue ?? null)]));
}

/** Para el body: vacío = null (el servidor valida y normaliza todo). */
export function customValuesPayload(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() ? v : null]));
}

// Campos personalizados dentro del formulario de ALTA de un módulo
// estándar (lead, contacto, empresa, oportunidad, tarea): así los
// obligatorios se pueden completar desde el primer momento. El servidor
// vuelve a validar todo (prepareCustomValues).
export function CustomFieldsFormSection({
  fields,
  values,
  onChange,
}: {
  fields: FormCustomField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const [picked, setPicked] = useState<Record<string, PickedRecord[]>>({});
  const visible = fields.filter((f) => f.type !== "image" && f.type !== "file");
  if (visible.length === 0) return null;
  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-100 p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Campos personalizados</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((f) => {
          const id = `ncf-${f.definitionId}`;
          const set = (v: string) => onChange({ ...values, [f.definitionId]: v });
          return (
            <div key={f.definitionId} className={f.type === "relation" || f.type === "multiselect" ? "sm:col-span-2" : undefined}>
              <Label htmlFor={id}>
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              {f.type === "relation" && f.targetEntity ? (
                <RecordPicker
                  id={id}
                  targetEntity={f.targetEntity}
                  multiple={!!f.multiple}
                  value={picked[f.definitionId] ?? []}
                  onChange={(next) => {
                    setPicked((p) => ({ ...p, [f.definitionId]: next }));
                    set(next.map((r) => r.id).join(","));
                  }}
                />
              ) : (
                <FieldInput id={id} label={f.label} type={f.type} options={f.options} value={values[f.definitionId] ?? ""} onChange={set} />
              )}
              {f.description && <p className="mt-1 text-xs text-slate-500">{f.description}</p>}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
