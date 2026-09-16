"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Select } from "@/components/ui/primitives";

interface TagOption {
  id: string;
  name: string;
}

export function TagPicker({
  entityType,
  entityId,
  assigned,
  allTags,
}: {
  entityType: string;
  entityId: string;
  assigned: TagOption[];
  allTags: TagOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const available = allTags.filter((t) => !assigned.some((a) => a.id === t.id));

  async function assign() {
    if (!selected) return;
    await fetch("/api/tags/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: selected, entityType, entityId }),
    });
    setSelected("");
    router.refresh();
  }

  async function unassign(tagId: string) {
    await fetch("/api/tags/unassign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId, entityType, entityId }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {assigned.map((t) => (
          <Badge key={t.id} className="cursor-pointer" >
            {t.name}
            <button type="button" onClick={() => unassign(t.id)} className="ml-1 text-slate-400 hover:text-slate-700">
              ×
            </button>
          </Badge>
        ))}
        {assigned.length === 0 && <span className="text-sm text-slate-400">Sin etiquetas</span>}
      </div>
      {available.length > 0 && (
        <div className="mt-2 flex gap-2">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-40">
            <option value="">Agregar etiqueta…</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" onClick={assign} disabled={!selected}>
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
