"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { FieldInput, toInputValue } from "@/components/custom-fields/field-input";
import { RecordPicker, type PickedRecord } from "@/components/custom-modules/record-picker";
import { ImageField } from "@/components/custom-modules/image-field";
import { errorMessage } from "@/lib/error-messages";

export interface RecordFormField {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  targetEntity: string | null;
  multiple: boolean;
  description?: string | null;
  defaultValue?: string | null;
}

// Alta y edición de un registro de módulo personalizado. Un solo envío con
// todos los valores (el servidor valida todo antes de escribir). Las
// imágenes van por su propio endpoint: al editar se suben al elegirlas; en
// el alta se suben después de crear el registro.
export function RecordForm({
  moduleId,
  basePath,
  singular,
  fields,
  members,
  record,
}: {
  moduleId: string;
  basePath: string;
  singular: string;
  fields: RecordFormField[];
  members: { userId: string; name: string }[];
  record?: {
    id: string;
    title: string;
    ownerId: string | null;
    values: Record<string, string | null>;
    relations: Record<string, PickedRecord[]>;
    images: Record<string, string | null>;
  };
}) {
  const router = useRouter();
  const editing = !!record;
  const [title, setTitle] = useState(record?.title ?? "");
  const [ownerId, setOwnerId] = useState(record?.ownerId ?? "");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.filter((f) => f.type !== "relation" && f.type !== "image").map((f) => [f.id, toInputValue(f.type, record ? record.values[f.id] : f.defaultValue)]))
  );
  const [relations, setRelations] = useState<Record<string, PickedRecord[]>>(
    Object.fromEntries(fields.filter((f) => f.type === "relation").map((f) => [f.id, record?.relations[f.id] ?? []]))
  );
  const [pendingImages, setPendingImages] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    setSaved(false);
    const payload = {
      title,
      ownerId: ownerId || null,
      values: {
        ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || null])),
        ...Object.fromEntries(Object.entries(relations).map(([k, list]) => [k, list.map((r) => r.id).join(",") || null])),
      },
    };
    const res = await fetch(editing ? `/api/modules/${moduleId}/records/${record!.id}` : `/api/modules/${moduleId}/records`, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res) {
      setSaving(false);
      setFormError("Sin conexión. Los cambios no se guardaron.");
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      if (body.fields) setErrors(body.fields);
      const zodMsg = body.details ? (Object.values(body.details.fieldErrors ?? {}).flat()[0] as string | undefined) : undefined;
      setFormError(body.fields ? "Revisá los campos marcados." : body.error === "automation_required" ? body.message : zodMsg ?? errorMessage(body.error));
      return;
    }

    if (!editing) {
      // Imágenes elegidas en el alta: se suben ya con el registro creado.
      const failed: string[] = [];
      for (const [defId, file] of Object.entries(pendingImages)) {
        if (!file) continue;
        const form = new FormData();
        form.append("file", file);
        const up = await fetch(`/api/modules/${moduleId}/records/${body.id}/images/${defId}`, { method: "POST", body: form }).catch(() => null);
        if (!up?.ok) failed.push(fields.find((f) => f.id === defId)?.label ?? "Imagen");
      }
      router.push(`${basePath}/${body.id}${failed.length ? "?imageError=1" : ""}`);
      router.refresh();
      return;
    }
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="rec-title">Nombre *</Label>
          <Input id="rec-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={`Nombre del ${singular}`} />
        </div>

        {fields.map((f) => {
          const id = `rec-${f.id}`;
          const wide = f.type === "relation" || f.type === "image" || f.type === "multiselect";
          return (
            <div key={f.id} className={wide ? "sm:col-span-2" : undefined}>
              <Label htmlFor={id}>
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              {f.type === "relation" && f.targetEntity ? (
                <RecordPicker
                  id={id}
                  targetEntity={f.targetEntity}
                  multiple={f.multiple}
                  value={relations[f.id] ?? []}
                  onChange={(v) => setRelations((r) => ({ ...r, [f.id]: v }))}
                />
              ) : f.type === "image" ? (
                <ImageField
                  id={id}
                  label={f.label}
                  url={record?.images[f.id] ?? null}
                  uploadUrl={editing ? `/api/modules/${moduleId}/records/${record!.id}/images/${f.id}` : undefined}
                  onPending={(file) => setPendingImages((p) => ({ ...p, [f.id]: file }))}
                />
              ) : (
                <FieldInput
                  id={id}
                  label={f.label}
                  type={f.type}
                  options={f.options}
                  value={values[f.id] ?? ""}
                  onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))}
                  invalid={!!errors[f.id]}
                />
              )}
              {f.description && <p className="mt-1 text-xs text-slate-500">{f.description}</p>}
              {errors[f.id] && <p className="mt-1 text-xs text-red-600">{errors[f.id]}</p>}
            </div>
          );
        })}

        <div>
          <Label htmlFor="rec-owner">Responsable</Label>
          <Select id="rec-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving} disabled={!title.trim()}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : `Crear ${singular}`}
        </Button>
        {!editing && (
          <Button type="button" variant="ghost" onClick={() => router.push(basePath)}>
            Cancelar
          </Button>
        )}
        {saved && <span role="status" className="animate-fade-in text-sm text-emerald-700">Guardado</span>}
      </div>
    </form>
  );
}
