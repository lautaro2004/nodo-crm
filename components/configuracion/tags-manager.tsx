"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, InlineAlert, Input, Spinner } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export function TagsManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  async function mutate(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
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

  async function createTag(e?: React.FormEvent) {
    e?.preventDefault();
    const value = name.trim();
    if (!value || busy) return;
    if (await mutate("create", "/api/tags", { method: "POST", body: JSON.stringify({ name: value }) })) {
      setName("");
      toast.success(`Etiqueta “${value}” creada`);
    }
  }

  async function deleteTag(t: Tag) {
    if (busy) return;
    const ok = await confirm({ title: `¿Borrar la etiqueta “${t.name}”?`, description: "Se quita de todos los registros que la tengan.", tone: "danger" });
    if (ok && (await mutate(`del:${t.id}`, `/api/tags/${t.id}`, { method: "DELETE" }))) toast.success("Etiqueta borrada");
  }

  return (
    <Card className="p-4">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
      <form onSubmit={createTag} className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva etiqueta…" aria-label="Nombre de la etiqueta" />
        <Button type="submit" loading={busy === "create"} disabled={!name.trim()}>
          {busy === "create" ? "Creando…" : "Crear"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge key={t.id} className={busy === `del:${t.id}` ? "opacity-60" : undefined}>
            {t.name}
            <button
              type="button"
              onClick={() => deleteTag(t)}
              disabled={!!busy}
              aria-label={`Borrar etiqueta ${t.name}`}
              className="ml-1.5 text-slate-400 transition-colors hover:text-red-600 disabled:opacity-50"
            >
              {busy === `del:${t.id}` ? <Spinner className="h-3 w-3" /> : "×"}
            </button>
          </Badge>
        ))}
        {tags.length === 0 && <p className="text-sm text-slate-400">Todavía no hay etiquetas.</p>}
      </div>
    </Card>
  );
}
