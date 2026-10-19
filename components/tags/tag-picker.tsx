"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Select, Spinner } from "@/components/ui/primitives";
import { readApiError } from "@/lib/error-messages";

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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(key: string, url: string, tagId: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, entityType, entityId }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Sin conexión. El cambio no se guardó.");
      return false;
    } finally {
      setBusy(null);
    }
  }
  const available = allTags.filter((t) => !assigned.some((a) => a.id === t.id));

  async function assign() {
    if (!selected || busy) return;
    if (await post("assign", "/api/tags/assign", selected)) setSelected("");
  }

  async function unassign(tagId: string) {
    if (busy) return;
    await post(`un:${tagId}`, "/api/tags/unassign", tagId);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {assigned.map((t) => (
          <Badge key={t.id} className={busy === `un:${t.id}` ? "opacity-60" : undefined}>
            {t.name}
            <button
              type="button"
              onClick={() => unassign(t.id)}
              disabled={!!busy}
              aria-label={`Quitar etiqueta ${t.name}`}
              className="ml-1 text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-50"
            >
              {busy === `un:${t.id}` ? <Spinner className="h-3 w-3" /> : "×"}
            </button>
          </Badge>
        ))}
        {assigned.length === 0 && <span className="text-sm text-slate-400">Sin etiquetas</span>}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
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
          <Button type="button" variant="secondary" onClick={assign} disabled={!selected} loading={busy === "assign"}>
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
