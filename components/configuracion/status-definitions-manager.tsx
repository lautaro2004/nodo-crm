"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Input, Select } from "@/components/ui/primitives";
import { RELATED_TYPE_LABELS } from "@/lib/labels";

interface StatusDef {
  id: string;
  entityType: string;
  key: string;
  label: string;
  color: string | null;
}

const ENTITY_TYPES = ["lead", "company"] as const;

export function StatusDefinitionsManager({ statuses }: { statuses: StatusDef[] }) {
  const router = useRouter();
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPES)[number]>("lead");
  const [label, setLabel] = useState("");

  async function createStatus() {
    if (!label.trim()) return;
    const key = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    await fetch("/api/status-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, key: key || `estado_${Date.now()}`, label }),
    });
    setLabel("");
    router.refresh();
  }

  async function deleteStatus(id: string) {
    await fetch(`/api/status-definitions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Nuevo estado</h2>
        <p className="mb-3 text-xs text-slate-500">
          Para Oportunidades, los estados se manejan como etapas de Pipeline — ver esa sección. Acá se configuran los estados de
          Lead y Empresa.
        </p>
        <div className="flex gap-2">
          <Select value={entityType} onChange={(e) => setEntityType(e.target.value as typeof entityType)} className="w-40">
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {RELATED_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: En negociación" />
          <Button type="button" onClick={createStatus}>
            Crear
          </Button>
        </div>
      </Card>

      {ENTITY_TYPES.map((t) => {
        const items = statuses.filter((s) => s.entityType === t);
        return (
          <Card key={t} className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{RELATED_TYPE_LABELS[t]}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">Sin estados configurados.</p>
            ) : (
              <ul className="space-y-1">
                {items.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span>{s.label}</span>
                    <button type="button" onClick={() => deleteStatus(s.id)} className="text-red-400 hover:text-red-600">
                      Borrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
