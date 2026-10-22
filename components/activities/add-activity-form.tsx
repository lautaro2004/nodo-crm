"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Select, Textarea } from "@/components/ui/primitives";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import { apiFetch } from "@/lib/api-fetch";
import { readApiError } from "@/lib/error-messages";
import { useToast } from "@/components/ui/toast";

export function AddActivityForm({ relatedType, relatedId }: { relatedType: string; relatedId: string }) {
  const router = useRouter();
  const [type, setType] = useState("note");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || loading) return;
    setLoading(true);
    setError(null);

    const res = await apiFetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relatedType, relatedId, type, body }),
    });

    setLoading(false);
    // Si falló, el texto se conserva para reintentar (antes se borraba igual).
    if (!res.ok) return setError(await readApiError(res));
    setBody("");
    toast.success("Actividad registrada");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2">
      <div className="flex gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-40">
          {Object.entries(ACTIVITY_TYPE_LABELS)
            .filter(
              ([key]) =>
                !["stage_change", "status_change", "converted"].includes(key) &&
                !key.startsWith("event_") &&
                !key.startsWith("instagram_") &&
                !key.startsWith("sheets_")
            )
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </Select>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Agregar una nota, llamada o reunión…"
          rows={2}
          className="flex-1"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={!body.trim()} loading={loading}>
        {loading ? "Guardando…" : "Registrar"}
      </Button>
    </form>
  );
}
