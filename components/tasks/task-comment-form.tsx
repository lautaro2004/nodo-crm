"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Textarea } from "@/components/ui/primitives";

// Comentario = Activity type "comment" — ver modules/tasks/service.ts. Se
// postea al endpoint genérico /api/activities (ya soporta relatedType
// "task"), sin un endpoint dedicado.
export function TaskCommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);

    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relatedType: "task", relatedId: taskId, type: "comment", body }),
    });

    setLoading(false);
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Agregar un comentario…" rows={2} />
      <Button type="submit" variant="secondary" disabled={loading || !body.trim()}>
        {loading ? "Guardando…" : "Comentar"}
      </Button>
    </form>
  );
}
