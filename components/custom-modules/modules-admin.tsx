"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { PlusIcon } from "@/components/ui/icons";
import { CustomModuleIcon } from "@/components/custom-modules/custom-module-icon";
import { readApiError } from "@/lib/error-messages";

interface ModuleRow {
  id: string;
  key: string;
  labelPlural: string;
  description: string | null;
  icon: string | null;
  archived: boolean;
  records: number;
}

interface TemplateCard {
  id: string;
  labelPlural: string;
  labelSingular: string;
  description: string;
  icon: string;
  fields: string[];
}

export function ModulesAdmin({ modules, templates, max }: { modules: ModuleRow[]; templates: TemplateCard[]; max: number }) {
  const router = useRouter();
  const [creating, setCreating] = useState<TemplateCard | "blank" | null>(null);
  const [plural, setPlural] = useState("");
  const [singular, setSingular] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start(t: TemplateCard | "blank") {
    setCreating(t);
    setPlural(t === "blank" ? "" : t.labelPlural);
    setSingular(t === "blank" ? "" : t.labelSingular);
    setDescription(t === "blank" ? "" : t.description);
    setError(null);
  }

  async function create() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelPlural: plural,
        labelSingular: singular || plural,
        description: description || null,
        templateId: creating && creating !== "blank" ? creating.id : null,
      }),
    });
    setSaving(false);
    if (!res.ok) return setError(await readApiError(res));
    const mod = await res.json();
    router.push(`/dashboard/configuracion/modulos/${mod.id}`);
    router.refresh();
  }

  const active = modules.filter((m) => !m.archived);
  const archived = modules.filter((m) => m.archived);

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((m) => (
            <ModuleCard key={m.id} m={m} />
          ))}
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Nuevo módulo</h2>
            <p className="text-xs text-slate-500">Arrancá de una plantilla (se puede editar todo después) o en blanco.</p>
          </div>
          <span className="text-xs text-slate-400">
            {modules.length} de {max}
          </span>
        </div>

        {!creating ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => start(t)}
                className="group rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700 [&>svg]:h-4 [&>svg]:w-4">
                  <CustomModuleIcon iconName={t.icon} />
                </span>
                <p className="text-sm font-semibold text-slate-900">{t.labelPlural}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.fields.join(" · ")}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => start("blank")}
              className="flex flex-col justify-center rounded-xl border border-dashed border-slate-300 p-3 text-left text-slate-600 transition-colors hover:border-brand-300 hover:text-slate-900"
            >
              <PlusIcon className="mb-2 h-5 w-5" />
              <p className="text-sm font-semibold">En blanco</p>
              <p className="text-xs text-slate-500">Definís vos los campos</p>
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="space-y-3"
          >
            {creating !== "blank" && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Plantilla <strong>{creating.labelPlural}</strong>: se crean los campos {creating.fields.join(", ")}.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mod-plural">Nombre (plural)</Label>
                <Input id="mod-plural" value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="Ej: Productos" required maxLength={40} />
              </div>
              <div>
                <Label htmlFor="mod-singular">Un registro se llama…</Label>
                <Input id="mod-singular" value={singular} onChange={(e) => setSingular(e.target.value)} placeholder="Ej: Producto" maxLength={40} />
              </div>
            </div>
            <div>
              <Label htmlFor="mod-desc">Descripción (opcional)</Label>
              <Textarea id="mod-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !plural.trim()}>
                {saving ? "Creando…" : "Crear módulo"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>

      {archived.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">Archivados</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((m) => (
              <ModuleCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ m }: { m: ModuleRow }) {
  return (
    <Card className={`flex items-start gap-3 p-4 ${m.archived ? "opacity-70" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&>svg]:h-[18px] [&>svg]:w-[18px]">
        <CustomModuleIcon iconName={m.icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{m.labelPlural}</p>
          {m.archived && <Badge>Archivado</Badge>}
        </div>
        <p className="text-xs text-slate-500">
          {m.records} {m.records === 1 ? "registro" : "registros"}
        </p>
        <div className="mt-2 flex gap-3 text-xs font-medium">
          <Link href={`/dashboard/configuracion/modulos/${m.id}`} className="text-brand-700 hover:underline">
            Configurar
          </Link>
          {!m.archived && (
            <Link href={`/dashboard/m/${m.key}`} className="text-slate-600 hover:text-slate-900">
              Abrir
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
