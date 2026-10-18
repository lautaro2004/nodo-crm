"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Label } from "@/components/ui/primitives";
import { FieldInput, toInputValue } from "@/components/custom-fields/field-input";

interface FieldWithValue {
  definitionId: string;
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  value: string | null;
}

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
        const control = (
          <FieldInput
            id={id}
            label={f.label}
            type={f.type}
            options={f.options ?? []}
            value={value}
            onChange={set}
            onEnter={dirty ? () => void save(f.definitionId) : undefined}
          />
        );

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
