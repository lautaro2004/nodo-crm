"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";
import { AVAILABLE_MODULES, STATIC_MODULE_LABELS } from "@/modules/workspace/available-modules";
import { apiFetch } from "@/lib/api-fetch";
import { readApiError } from "@/lib/error-messages";
import { useToast } from "@/components/ui/toast";

export function ModulesToggle({ activeModules, opportunityLabelPlural }: { activeModules: string[]; opportunityLabelPlural: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(activeModules);
  const [saving, setSaving] = useState(false);

  // El nombre de "opportunities" en esta lista es el que configuró el
  // Workspace (ver /dashboard/configuracion/modulo-oportunidades) — el
  // resto son fijos, no son módulos configurables en esta fase.
  const ALL_MODULES = AVAILABLE_MODULES.map((key) => ({
    key,
    label: key === "opportunities" ? opportunityLabelPlural : STATIC_MODULE_LABELS[key],
  }));

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await apiFetch("/api/workspace/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeModules: selected }),
    });
    setSaving(false);
    if (!res.ok) return setError(await readApiError(res));
    toast.success("Módulos actualizados");
    router.refresh();
  }

  return (
    <div>
      <div className="space-y-2">
        {ALL_MODULES.map((m) => (
          <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(m.key)}
              onChange={() => toggle(m.key)}
              className="h-4 w-4 accent-slate-900"
            />
            {m.label}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="button" className="mt-3" onClick={save} loading={saving}>
        {saving ? "Guardando…" : "Guardar módulos"}
      </Button>
    </div>
  );
}
