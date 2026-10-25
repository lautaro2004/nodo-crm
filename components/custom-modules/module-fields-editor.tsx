"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { CUSTOM_FIELD_TYPE_LABELS } from "@/lib/custom-fields";
import { customFieldTypes } from "@/lib/schemas";
import { slugifyKey } from "@/modules/import/shared";
import { errorMessage, readApiError } from "@/lib/error-messages";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CARDINALITIES, FieldDefinitionEditor, cardinalityOf, type EditableField } from "@/components/custom-fields/field-definition-editor";
import { useToast } from "@/components/ui/toast";

type FieldRow = EditableField;

const TYPE_LABELS: Record<string, string> = { ...CUSTOM_FIELD_TYPE_LABELS, image: "Imagen", relation: "Relación con otro módulo" };

// Campos de UN módulo (personalizado o estándar): alta, edición completa
// (ver FieldDefinitionEditor), orden y baja. El tipo no se cambia después
// de crear (reinterpretaría los valores cargados).
export function ModuleFieldsEditor({
  entityType,
  fields,
  targets,
  title = "Campos",
  intro,
  allowImage = true,
}: {
  moduleId?: string;
  entityType: string;
  fields: FieldRow[];
  targets: { value: string; label: string }[];
  title?: string;
  intro?: React.ReactNode;
  /** Imagen: solo en módulos personalizados (se suben a su propio bucket). */
  allowImage?: boolean;
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
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">
          {intro ?? (
            <>
              Todo registro tiene <strong>Nombre</strong> (obligatorio) y Responsable. Sumá los campos que necesites; el orden es el del formulario.
            </>
          )}
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
                    {f.type === "relation" && f.targetLabel ? ` → ${f.targetLabel} · ${CARDINALITIES.find((c) => c.value === cardinalityOf(f.multiple, !!f.exclusive))!.label}` : ""}
                    {f.defaultValue ? ` · predeterminado: ${f.defaultValue}` : ""}
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
              {editing === f.id && <FieldDefinitionEditor field={f} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <NewField entityType={entityType} targets={targets} allowImage={allowImage} />
    </Card>
  );
}

function NewField({ entityType, targets, allowImage }: { entityType: string; targets: { value: string; label: string }[]; allowImage: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [target, setTarget] = useState(targets[0]?.value ?? "contact");
  const [cardinality, setCardinality] = useState<string>("many_to_one");
  const [description, setDescription] = useState("");
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
        description: description.trim() || null,
        ...(type === "relation"
          ? (() => {
              const c = CARDINALITIES.find((x) => x.value === cardinality)!;
              return { targetEntity: target, multiple: c.multiple, exclusive: c.exclusive };
            })()
          : {}),
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
    setDescription("");
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
            {customFieldTypes.filter((t) => allowImage || t !== "image").map((t) => (
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
        <div className="sm:col-span-2">
          <Label htmlFor="nf-desc">Descripción (opcional)</Label>
          <Input id="nf-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Ayuda que se ve debajo del campo" />
        </div>
        {type === "relation" && (
          <div>
            <Label htmlFor="nf-card">Tipo de relación</Label>
            <Select id="nf-card" value={cardinality} onChange={(e) => setCardinality(e.target.value)}>
              {CARDINALITIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
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
        {type === "image" && <Badge>JPG, PNG, WebP o GIF · hasta 5 MB</Badge>}
      </div>
      {notice && <p className={`mt-2 text-sm ${notice.tone === "error" ? "text-red-600" : "text-slate-600"}`}>{notice.text}</p>}
      <Button type="submit" size="sm" className="mt-3" disabled={!label.trim()} loading={saving}>
        {saving ? "Agregando…" : "Agregar campo"}
      </Button>
    </form>
  );
}
