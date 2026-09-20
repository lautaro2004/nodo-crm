"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Input, Select } from "@/components/ui/primitives";
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
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("q", q);
        }}
        className="min-w-56 flex-1"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => updateParam("q", q)} placeholder={searchPlaceholder} />
      </form>
      <Select defaultValue={searchParams.get("priority") ?? ""} onChange={(e) => updateParam("priority", e.target.value)} className="w-44">
        <option value="">Toda prioridad</option>
        {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
