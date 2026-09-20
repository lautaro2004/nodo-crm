"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/primitives";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/labels";

export function CalendarFilters({ members }: { members: { userId: string; name: string; email: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={sp.get("owner") ?? ""} onChange={(e) => update("owner", e.target.value)} className="w-48" aria-label="Responsable">
        <option value="">Todos los eventos</option>
        <option value="me">Mis eventos</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name || m.email}
          </option>
        ))}
      </Select>
      <Select value={sp.get("type") ?? ""} onChange={(e) => update("type", e.target.value)} className="w-44" aria-label="Tipo">
        <option value="">Todos los tipos</option>
        {Object.entries(CALENDAR_EVENT_TYPE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
