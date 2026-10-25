"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Label } from "@/components/ui/primitives";
import { FieldInput, toInputValue } from "@/components/custom-fields/field-input";
import { RecordPicker, type PickedRecord } from "@/components/custom-modules/record-picker";
import { formatCustomValue } from "@/lib/custom-fields";
import { apiFetch } from "@/lib/api-fetch";

interface FieldWithValue {
  definitionId: string;
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  description?: string | null;
  targetEntity?: string | null;
  multiple?: boolean;
  value: string | null;
}

type Labels = Record<string, { label: string; href: string }>;

export function CustomFieldsEditor({
  entityId,
  fields,
  relationLabels = {},
  readOnly = false,
}: {
  entityId: string;
  fields: FieldWithValue[];
  relationLabels?: Labels;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const initial = Object.fromEntries(fields.map((f) => [f.definitionId, f.type === "relation" ? (f.value ?? "") : toInputValue(f.type, f.value)]));
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [picked, setPicked] = useState<Record<string, PickedRecord[]>>(() =>
    Object.fromEntries(
      fields
        .filter((f) => f.type === "relation")
        .map((f) => [
          f.definitionId,
          (f.value ?? "")
            .split(",")
            .filter(Boolean)
            .map((id) => ({ id, label: relationLabels[`${f.targetEntity}:${id}`]?.label ?? "Registro" })),
        ])
    )
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(definitionId: string, override?: string) {
    const value = override ?? values[definitionId] ?? "";
    setSaving(definitionId);
    setErrors((e) => ({ ...e, [definitionId]: "" }));
    const res = await apiFetch("/api/custom-field-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId, entityId, value: value || null }),
    });
    setSaving(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.error === "automation_required") return; // lo pide el diálogo de automatizaciones
      setErrors((e) => ({ ...e, [definitionId]: body.message ?? (res.status === 403 ? "No tenés permiso para editar este registro." : "No se pudo guardar. Intentá de nuevo.") }));
      return;
    }
    setSaved((s) => ({ ...s, [definitionId]: value }));
    router.refresh();
  }

  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((f) => {
        const value = values[f.definitionId] ?? "";
        const dirty = value !== (saved[f.definitionId] ?? "");
        const set = (v: string) => setValues((prev) => ({ ...prev, [f.definitionId]: v }));
        const id = `cf-${f.definitionId}`;

        if (readOnly) {
          return (
            <div key={f.definitionId}>
              <p className="text-xs text-slate-500">{f.label}</p>
              <div className="mt-0.5 text-sm text-slate-900">
                {f.type === "relation" ? (
                  <RelationLinks ids={value} target={f.targetEntity} labels={relationLabels} />
                ) : (
                  formatCustomValue(f.type, saved[f.definitionId]) || <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
          );
        }

        const control =
          f.type === "relation" && f.targetEntity ? (
            <RecordPicker
              id={id}
              targetEntity={f.targetEntity}
              multiple={!!f.multiple}
              value={picked[f.definitionId] ?? []}
              onChange={(next) => {
                setPicked((p) => ({ ...p, [f.definitionId]: next }));
                const ids = next.map((r) => r.id).join(",");
                set(ids);
                void save(f.definitionId, ids);
              }}
            />
          ) : (
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
              {dirty && f.type !== "relation" && (
                <Button type="button" variant="secondary" onClick={() => save(f.definitionId)} disabled={saving === f.definitionId}>
                  {saving === f.definitionId ? "Guardando…" : "Guardar"}
                </Button>
              )}
            </div>
            {f.description && <p className="mt-1 text-xs text-slate-500">{f.description}</p>}
            {errors[f.definitionId] && <p className="mt-1 text-xs text-red-600">{errors[f.definitionId]}</p>}
          </div>
        );
      })}
    </div>
  );
}

function RelationLinks({ ids, target, labels }: { ids: string; target?: string | null; labels: Labels }) {
  const list = ids.split(",").filter(Boolean);
  if (!list.length || !target) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-x-2">
      {list.map((id) => {
        const info = labels[`${target}:${id}`];
        return info ? (
          <Link key={id} href={info.href} className="underline hover:text-brand-700">
            {info.label}
          </Link>
        ) : null;
      })}
    </span>
  );
}
