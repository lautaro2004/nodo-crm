"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Select, Textarea } from "@/components/ui/primitives";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";

export function AddActivityForm({ relatedType, relatedId }: { relatedType: string; relatedId: string }) {
  const router = useRouter();
  const [type, setType] = useState("note");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);

    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relatedType, relatedId, type, body }),
    });

    setLoading(false);
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2">
      <div className="flex gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-40">
          {Object.entries(ACTIVITY_TYPE_LABELS)
            .filter(([key]) => key !== "stage_change" && key !== "status_change")
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
      <Button type="submit" variant="secondary" disabled={loading || !body.trim()}>
        {loading ? "Guardando…" : "Registrar"}
      </Button>
    </form>
  );
}
