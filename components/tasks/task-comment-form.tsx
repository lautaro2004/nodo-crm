"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Textarea } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/api-fetch";
import { readApiError } from "@/lib/error-messages";
import { useToast } from "@/components/ui/toast";

// Comentario = Activity type "comment" — ver modules/tasks/service.ts. Se
// postea al endpoint genérico /api/activities (ya soporta relatedType
// "task"), sin un endpoint dedicado.
export function TaskCommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
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
      body: JSON.stringify({ relatedType: "task", relatedId: taskId, type: "comment", body }),
    });

    setLoading(false);
    // Si falló, el texto se conserva para reintentar (antes se borraba igual).
    if (!res.ok) return setError(await readApiError(res));
    setBody("");
    toast.success("Comentario agregado");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Agregar un comentario…" rows={2} />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={!body.trim()} loading={loading}>
        {loading ? "Guardando…" : "Comentar"}
      </Button>
    </form>
  );
}
