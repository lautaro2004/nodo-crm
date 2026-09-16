"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Input } from "@/components/ui/primitives";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export function TagsManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");

  async function createTag() {
    if (!name.trim()) return;
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    router.refresh();
  }

  async function deleteTag(id: string) {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva etiqueta…" />
        <Button type="button" onClick={createTag}>
          Crear
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge key={t.id}>
            {t.name}
            <button type="button" onClick={() => deleteTag(t.id)} className="ml-1.5 text-slate-400 hover:text-red-600">
              ×
            </button>
          </Badge>
        ))}
        {tags.length === 0 && <p className="text-sm text-slate-400">Todavía no hay etiquetas.</p>}
      </div>
    </Card>
  );
}
