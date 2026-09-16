"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { customFieldTypes } from "@/lib/schemas";
import { RELATED_TYPE_LABELS } from "@/lib/labels";

interface Definition {
  id: string;
  entityType: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
}

const ENTITY_TYPES = ["lead", "contact", "company", "opportunity"] as const;

export function CustomFieldsManager({ definitions }: { definitions: Definition[] }) {
  const router = useRouter();
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number]>("lead");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<string>("text");
  const [options, setOptions] = useState("");

  async function createDefinition() {
    if (!label.trim()) return;
    const key = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    await fetch("/api/custom-field-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        key: key || `campo_${Date.now()}`,
        label,
        type,
        options: type === "select" || type === "multiselect" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      }),
    });
    setLabel("");
    setOptions("");
    router.refresh();
  }

  async function deleteDefinition(id: string) {
    if (!confirm("¿Borrar este campo personalizado? Se pierden los valores ya cargados.")) return;
    await fetch(`/api/custom-field-definitions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Nuevo campo personalizado</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Entidad</Label>
            <Select value={entityType} onChange={(e) => setEntityType(e.target.value as typeof entityType)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RELATED_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Nombre</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Rubro" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {customFieldTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          {(type === "select" || type === "multiselect") && (
            <div>
              <Label>Opciones (separadas por coma)</Label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="A, B, C" />
            </div>
          )}
        </div>
        <Button type="button" className="mt-3" onClick={createDefinition}>
          Agregar campo
        </Button>
      </Card>

      {ENTITY_TYPES.map((t) => {
        const items = definitions.filter((d) => d.entityType === t);
        if (items.length === 0) return null;
        return (
          <Card key={t} className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{RELATED_TYPE_LABELS[t]}</h2>
            <ul className="space-y-1">
              {items.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span>
                    {d.label} <span className="text-slate-400">({d.type})</span>
                  </span>
                  <button type="button" onClick={() => deleteDefinition(d.id)} className="text-red-400 hover:text-red-600">
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
