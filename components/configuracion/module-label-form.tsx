"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { ModuleIcon } from "@/components/ui/module-icon";
import { MODULE_ICONS, type ModuleIconKey, type ModuleLabel } from "@/modules/workspace/module-config-shared";

const ICON_NAMES: Record<ModuleIconKey, string> = {
  "trending-up": "Tendencia",
  target: "Objetivo",
  calendar: "Calendario",
  "check-square": "Check",
  building: "Edificio",
};

// Un único módulo configurable hoy (Opportunity) — ver
// modules/workspace/module-config.ts. El componente ya recibe
// `internalModule` como prop para no tener que tocarlo cuando se agregue
// un segundo módulo configurable más adelante.
export function ModuleLabelForm({ moduleLabel }: { moduleLabel: ModuleLabel }) {
  const router = useRouter();
  const [labelSingular, setLabelSingular] = useState(moduleLabel.labelSingular);
  const [labelPlural, setLabelPlural] = useState(moduleLabel.labelPlural);
  const [icon, setIcon] = useState<ModuleIconKey>(moduleLabel.icon);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/module-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internalModule: moduleLabel.internalModule, labelSingular, labelPlural, icon }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="max-w-md space-y-4">
      {!moduleLabel.enabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este módulo está desactivado (Módulos activos, arriba). El nombre igual queda guardado para cuando lo reactives.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="labelSingular">Nombre singular</Label>
          <Input id="labelSingular" value={labelSingular} onChange={(e) => setLabelSingular(e.target.value)} placeholder="Ej: Venta" />
        </div>
        <div>
          <Label htmlFor="labelPlural">Nombre plural</Label>
          <Input id="labelPlural" value={labelPlural} onChange={(e) => setLabelPlural(e.target.value)} placeholder="Ej: Ventas" />
        </div>
      </div>
      <div>
        <Label htmlFor="icon">Ícono en el menú</Label>
        <div className="flex items-center gap-2">
          <ModuleIcon icon={icon} className="h-5 w-5 shrink-0 text-slate-500" />
          <Select id="icon" value={icon} onChange={(e) => setIcon(e.target.value as ModuleIconKey)}>
            {MODULE_ICONS.map((k) => (
              <option key={k} value={k}>
                {ICON_NAMES[k]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" disabled={saving || !labelSingular.trim() || !labelPlural.trim()} onClick={save}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {saved && !saving && <span className="text-xs text-emerald-600">Guardado.</span>}
      </div>
    </div>
  );
}
