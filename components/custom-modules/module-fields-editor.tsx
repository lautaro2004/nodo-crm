"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { CUSTOM_FIELD_TYPE_LABELS } from "@/lib/custom-fields";
import { customFieldTypes } from "@/lib/schemas";
import { slugifyKey } from "@/modules/import/shared";
import { errorMessage, readApiError } from "@/lib/error-messages";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface FieldRow {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  targetEntity: string | null;
  targetLabel: string | null;
  multiple: boolean;
}

const TYPE_LABELS: Record<string, string> = { ...CUSTOM_FIELD_TYPE_LABELS, image: "Imagen", relation: "Relación con otro módulo" };

// Campos de UN módulo personalizado: alta, edición (nombre, opciones,
// obligatorio), orden y baja. El tipo no se cambia después de crear.
export function ModuleFieldsEditor({
  entityType,
  fields,
  targets,
}: {
  moduleId: string;
  entityType: string;
  fields: FieldRow[];
  targets: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState(fields.map((f) => f.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const byId = new Map(fields.map((f) => [f.id, f]));
  const ordered = order.map((id) => byId.get(id)).filter((f): f is FieldRow => !!f);
  // Campos nuevos (después de router.refresh) al final.
  for (const f of fields) if (!order.includes(f.id)) ordered.push(f);

  async function move(id: string, dir: -1 | 1) {
    const ids = ordered.map((f) => f.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length || busy) return;
    const previous = ordered.map((f) => f.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setOrder(ids); // optimista
    setBusy("move");
    setError(null);
    try {
      const res = await fetch("/api/custom-field-definitions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, ids }),
      });
      if (!res.ok) {
        setOrder(previous);
        return setError(await readApiError(res));
      }
      router.refresh();
    } catch {
      setOrder(previous);
      setError("Sin conexión. El orden no se guardó.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(f: FieldRow) {
    const ok = await confirm({ title: `¿Borrar el campo “${f.label}”?`, description: "Se pierden los valores cargados en todos los registros.", tone: "danger" });
    if (!ok) return;
    setBusy(`del:${f.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/custom-field-definitions/${f.id}`, { method: "DELETE" });
      if (!res.ok) return setError(await readApiError(res));
      toast.success(`Campo “${f.label}” borrado`);
      router.refresh();
    } catch {
      setError("Sin conexión. El campo no se borró.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Campos</h2>
        <p className="text-xs text-slate-500">
          Todo registro tiene <strong>Nombre</strong> (obligatorio) y Responsable. Sumá los campos que necesites; el orden es el del formulario.
        </p>
      </div>

      {ordered.length === 0 ? (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Todavía no hay campos.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {ordered.map((f, idx) => (
            <li key={f.id} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" aria-label={`Subir ${f.label}`} disabled={idx === 0 || !!busy} onClick={() => move(f.id, -1)} className="px-1 text-xs leading-none text-slate-400 hover:text-slate-900 disabled:opacity-30">
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Bajar ${f.label}`}
                    disabled={idx === ordered.length - 1 || !!busy}
                    onClick={() => move(f.id, 1)}
                    className="px-1 text-xs leading-none text-slate-400 hover:text-slate-900 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {TYPE_LABELS[f.type] ?? f.type}
                    {f.type === "relation" && f.targetLabel ? ` → ${f.targetLabel}${f.multiple ? " (varios)" : ""}` : ""}
                    {f.options.length > 0 ? ` · ${f.options.join(", ")}` : ""}
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(editing === f.id ? null : f.id)}>
                  Editar
                </Button>
                <button type="button" onClick={() => remove(f)} disabled={!!busy} className="text-xs text-red-400 transition-colors hover:text-red-600 disabled:opacity-50">
                  {busy === `del:${f.id}` ? "Borrando…" : "Borrar"}
                </button>
              </div>
              {editing === f.id && <EditField field={f} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <NewField entityType={entityType} targets={targets} />
    </Card>
  );
}

function EditField({ field, onDone }: { field: FieldRow; onDone: () => void }) {
  const router = useRouter();
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState(field.options.join(", "));
  const [required, setRequired] = useState(field.required);
  const [multiple, setMultiple] = useState(field.multiple);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const hasOptions = field.type === "select" || field.type === "multiselect";

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/custom-field-definitions/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        required,
        ...(hasOptions ? { options: options.split(",").map((o) => o.trim()).filter(Boolean) } : {}),
        ...(field.type === "relation" ? { multiple } : {}),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res) return setError("Sin conexión. Los cambios no se guardaron.");
    if (!res.ok) return setError(await readApiError(res));
    toast.success("Campo actualizado");
    onDone();
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`ef-label-${field.id}`}>Nombre</Label>
          <Input id={`ef-label-${field.id}`} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
        </div>
        {hasOptions && (
          <div>
            <Label htmlFor={`ef-opts-${field.id}`}>Opciones (separadas por coma)</Label>
            <Input id={`ef-opts-${field.id}`} value={options} onChange={(e) => setOptions(e.target.value)} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        {field.type !== "image" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Obligatorio
          </label>
        )}
        {field.type === "relation" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Permite varios
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={!label.trim()} loading={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function NewField({ entityType, targets }: { entityType: string; targets: { value: string; label: string }[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [target, setTarget] = useState(targets[0]?.value ?? "contact");
  const [multiple, setMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const toast = useToast();

  async function add() {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const res = await fetch("/api/custom-field-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        key: slugifyKey(label),
        label: label.trim(),
        type,
        required: type === "image" ? false : required,
        options: type === "select" || type === "multiselect" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
        ...(type === "relation" ? { targetEntity: target, multiple } : {}),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res) return setNotice({ tone: "error", text: "Sin conexión. El campo no se creó." });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ tone: "error", text: errorMessage(body.error) });
    if (body.existing) setNotice({ tone: "info", text: `"${body.label}" ya existía en este módulo.` });
    else toast.success(`Campo “${label.trim()}” agregado`);
    setLabel("");
    setOptions("");
    setRequired(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
      className="rounded-xl border border-dashed border-slate-200 p-3"
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Agregar campo</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="nf-label">Nombre</Label>
          <Input id="nf-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Precio" />
        </div>
        <div>
          <Label htmlFor="nf-type">Tipo</Label>
          <Select id="nf-type" value={type} onChange={(e) => setType(e.target.value)}>
            {customFieldTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </Select>
        </div>
        {(type === "select" || type === "multiselect") && (
          <div className="sm:col-span-2">
            <Label htmlFor="nf-options">Opciones (separadas por coma)</Label>
            <Input id="nf-options" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Chico, Mediano, Grande" />
          </div>
        )}
        {type === "relation" && (
          <div>
            <Label htmlFor="nf-target">Se relaciona con</Label>
            <Select id="nf-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              {targets.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-700">
        {type !== "image" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Obligatorio
          </label>
        )}
        {type === "relation" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Permite varios
          </label>
        )}
        {type === "image" && <Badge>JPG, PNG, WebP o GIF · hasta 5 MB</Badge>}
      </div>
      {notice && <p className={`mt-2 text-sm ${notice.tone === "error" ? "text-red-600" : "text-slate-600"}`}>{notice.text}</p>}
      <Button type="submit" size="sm" className="mt-3" disabled={!label.trim()} loading={saving}>
        {saving ? "Agregando…" : "Agregar campo"}
      </Button>
    </form>
  );
}
