"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";

export function SyncNexoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/nexo/sync-leads", { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      setResult("No pudimos sincronizar.");
      return;
    }
    const data = await res.json();
    setResult(`${data.created} lead${data.created === 1 ? "" : "s"} nuevo${data.created === 1 ? "" : "s"} desde Nexo.`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" onClick={sync} disabled={loading}>
        {loading ? "Sincronizando…" : "Sincronizar con Nexo"}
      </Button>
      {result && <span className="text-xs text-slate-500">{result}</span>}
    </div>
  );
}
