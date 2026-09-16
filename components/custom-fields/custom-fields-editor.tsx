"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label } from "@/components/ui/primitives";

interface FieldWithValue {
  definitionId: string;
  key: string;
  label: string;
  type: string;
  value: string | null;
}

export function CustomFieldsEditor({ entityId, fields }: { entityId: string; fields: FieldWithValue[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.definitionId, f.value ?? ""]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function save(definitionId: string) {
    setSaving(definitionId);
    await fetch("/api/custom-field-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId, entityId, value: values[definitionId] || null }),
    });
    setSaving(null);
    router.refresh();
  }

  if (fields.length === 0) return null;

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.definitionId} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor={f.definitionId}>{f.label}</Label>
            <Input
              id={f.definitionId}
              type={f.type === "number" || f.type === "currency" ? "number" : f.type === "date" ? "date" : "text"}
              value={values[f.definitionId] ?? ""}
              onChange={(e) => setValues({ ...values, [f.definitionId]: e.target.value })}
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => save(f.definitionId)} disabled={saving === f.definitionId}>
            Guardar
          </Button>
        </div>
      ))}
    </div>
  );
}
