"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Input, Select, Spinner } from "@/components/ui/primitives";
import { SearchIcon } from "@/components/ui/icons";

interface Option {
  value: string;
  label: string;
}

// Reutilizable en las listas de Empresas/Contactos/Leads/Oportunidades:
// actualiza la URL (?q=…&status=…&ownerId=…&sort=…) y la page (server
// component) vuelve a leer con esos filtros. Al vivir en la URL, los
// filtros se conservan al alternar Lista/Kanban y se pueden compartir.
export function SearchFilterBar({
  searchPlaceholder,
  statusOptions,
  tagOptions,
  ownerOptions,
  sortOptions,
}: {
  searchPlaceholder: string;
  statusOptions?: Option[];
  tagOptions?: Option[];
  ownerOptions?: Option[];
  sortOptions?: Option[];
}) {
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
    <div className="mb-4 flex flex-wrap items-center gap-2">
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
      {statusOptions && (
        <Select aria-label="Filtrar por estado" defaultValue={searchParams.get("status") ?? ""} onChange={(e) => updateParam("status", e.target.value)} className="w-auto min-w-40">
          <option value="">Todos los estados</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
      {ownerOptions && ownerOptions.length > 0 && (
        <Select aria-label="Filtrar por responsable" defaultValue={searchParams.get("ownerId") ?? ""} onChange={(e) => updateParam("ownerId", e.target.value)} className="w-auto min-w-40">
          <option value="">Todos los responsables</option>
          <option value="none">Sin asignar</option>
          {ownerOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
      {tagOptions && tagOptions.length > 0 && (
        <Select aria-label="Filtrar por etiqueta" defaultValue={searchParams.get("tagId") ?? ""} onChange={(e) => updateParam("tagId", e.target.value)} className="w-auto min-w-40">
          <option value="">Todas las etiquetas</option>
          {tagOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
      {sortOptions && (
        <Select aria-label="Ordenar" defaultValue={searchParams.get("sort") ?? ""} onChange={(e) => updateParam("sort", e.target.value)} className="w-auto min-w-40">
          {sortOptions.map((opt, i) => (
            <option key={opt.value} value={i === 0 ? "" : opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
