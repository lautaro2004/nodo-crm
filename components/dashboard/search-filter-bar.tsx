"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Input, Select } from "@/components/ui/primitives";

interface StatusOption {
  value: string;
  label: string;
}

// Reutilizable en las listas de Empresas/Contactos/Leads/Oportunidades —
// Fase 3N/3O (búsqueda + filtros): actualiza la URL (?q=...&status=...) y
// deja que la page (server component) vuelva a leer con esos filtros, sin
// duplicar la lógica de query en cada módulo.
export function SearchFilterBar({
  searchPlaceholder,
  statusOptions,
  tagOptions,
}: {
  searchPlaceholder: string;
  statusOptions?: StatusOption[];
  tagOptions?: StatusOption[];
}) {
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
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => updateParam("q", q)}
          placeholder={searchPlaceholder}
        />
      </form>
      {statusOptions && (
        <Select
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
          className="w-48"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
      {tagOptions && tagOptions.length > 0 && (
        <Select
          defaultValue={searchParams.get("tagId") ?? ""}
          onChange={(e) => updateParam("tagId", e.target.value)}
          className="w-44"
        >
          <option value="">Todas las etiquetas</option>
          {tagOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
