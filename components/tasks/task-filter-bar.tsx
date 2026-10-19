"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Input, Spinner } from "@/components/ui/primitives";
import { SearchIcon } from "@/components/ui/icons";
import { SelectMenu } from "@/components/ui/select-menu";
import { PendingBar } from "@/components/ui/pending-bar";
import { TASK_PRIORITY_LABELS } from "@/lib/labels";

// Mismo patrón que SearchFilterBar (components/dashboard/search-filter-bar.tsx)
// pero con sus propias query keys ("q" + "priority") — el filtro de estado
// de Tareas ya lo cubren las tabs (?view=), así que acá no hay un segundo
// selector de "status" que pisaría esa semántica.
export function TaskFilterBar({ searchPlaceholder }: { searchPlaceholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if ((searchParams.get(key) ?? "") === value) return;
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="relative mb-4 flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
      <PendingBar active={pending} />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("q", q.trim());
        }}
        className="relative min-w-56 flex-1"
      >
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {pending ? <Spinner className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
        </span>
        <Input
          type="search"
          aria-label="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => updateParam("q", q.trim())}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </form>
      <SelectMenu
        ariaLabel="Filtrar por prioridad"
        value={searchParams.get("priority") ?? ""}
        onChange={(v) => updateParam("priority", v)}
        className="w-44"
        options={[{ value: "", label: "Toda prioridad" }, ...Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))]}
      />
    </div>
  );
}
