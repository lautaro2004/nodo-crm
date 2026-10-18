"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { CustomModuleIcon } from "@/components/custom-modules/custom-module-icon";
import { MODULE_ICONS } from "@/lib/custom-modules";
import { readApiError } from "@/lib/error-messages";

interface ModuleData {
  id: string;
  key: string;
  labelPlural: string;
  labelSingular: string;
  description: string | null;
  icon: string | null;
  archived: boolean;
  priceFieldId: string | null;
  imageFieldId: string | null;
  codeFieldId: string | null;
}

const ROLES = [
  { key: "priceFieldId", label: "Precio", hint: "Se usa al sumar el registro a una oportunidad.", types: ["currency", "number"] },
  { key: "codeFieldId", label: "Código", hint: "Se muestra en el selector y las listas.", types: ["text"] },
  { key: "imageFieldId", label: "Imagen", hint: "Miniatura en el selector y el detalle.", types: ["image"] },
] as const;

export function ModuleSettings({ module: m, fields }: { module: ModuleData; fields: { id: string; label: string; type: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    labelPlural: m.labelPlural,
    labelSingular: m.labelSingular,
    description: m.description ?? "",
    icon: m.icon ?? "box",
    priceFieldId: m.priceFieldId ?? "",
    codeFieldId: m.codeFieldId ?? "",
    imageFieldId: m.imageFieldId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/modules/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: await readApiError(res) });
      return false;
    }
    setMessage({ tone: "ok", text: "Guardado." });
    router.refresh();
    return true;
  }

  async function remove() {
    if (!confirm(`¿Borrar "${m.labelPlural}" definitivamente? Se pierden todos sus registros, campos y relaciones. No se puede deshacer.`)) return;
    const res = await fetch(`/api/modules/${m.id}`, { method: "DELETE" });
    if (!res.ok) return setMessage({ tone: "error", text: await readApiError(res) });
    router.push("/dashboard/configuracion/modulos");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Datos del módulo</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void patch({
              labelPlural: form.labelPlural,
              labelSingular: form.labelSingular,
              description: form.description || null,
              icon: form.icon,
              priceFieldId: form.priceFieldId || null,
              codeFieldId: form.codeFieldId || null,
              imageFieldId: form.imageFieldId || null,
            });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ms-plural">Nombre del módulo</Label>
              <Input id="ms-plural" value={form.labelPlural} maxLength={40} onChange={(e) => setForm({ ...form, labelPlural: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ms-singular">Un registro</Label>
              <Input id="ms-singular" value={form.labelSingular} maxLength={40} onChange={(e) => setForm({ ...form, labelSingular: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="ms-desc">Descripción</Label>
            <Textarea id="ms-desc" rows={2} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-slate-700">Ícono</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícono">
              {MODULE_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  role="radio"
                  aria-checked={form.icon === icon}
                  aria-label={icon}
                  onClick={() => setForm({ ...form, icon })}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px] ${
                    form.icon === icon ? "bg-brand-50 text-brand-700 ring-brand-300" : "bg-white text-slate-500 ring-slate-200 hover:text-slate-800"
                  }`}
                >
                  <CustomModuleIcon iconName={icon} />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Campos con rol</p>
            <div className="space-y-2">
              {ROLES.map((r) => {
                const options = fields.filter((f) => (r.types as readonly string[]).includes(f.type));
                return (
                  <div key={r.key}>
                    <Label htmlFor={`role-${r.key}`}>{r.label}</Label>
                    <Select id={`role-${r.key}`} value={form[r.key]} onChange={(e) => setForm({ ...form, [r.key]: e.target.value })}>
                      <option value="">— Ninguno —</option>
                      {options.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-slate-400">{r.hint}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {message && <p className={`text-sm ${message.tone === "error" ? "text-red-600" : "text-emerald-700"}`}>{message.text}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">{m.archived ? "Módulo archivado" : "Archivar"}</h2>
        <p className="mb-3 text-xs text-slate-500">
          {m.archived
            ? "No aparece en la navegación ni admite registros nuevos. Sus datos siguen guardados."
            : "Oculta el módulo de la navegación sin borrar nada. Se puede restaurar."}
        </p>
        <div className="flex flex-wrap gap-2">
          {m.archived ? (
            <>
              <Button variant="secondary" disabled={saving} onClick={() => patch({ archived: false })}>
                Restaurar
              </Button>
              <Button variant="danger" onClick={remove}>
                Borrar definitivamente
              </Button>
            </>
          ) : (
            <>
              <Link href={`/dashboard/m/${m.key}`}>
                <Button variant="secondary">Abrir módulo</Button>
              </Link>
              <Button variant="ghost" disabled={saving} onClick={() => patch({ archived: true })}>
                Archivar
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
