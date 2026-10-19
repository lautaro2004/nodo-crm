"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { Input, Spinner } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/select-menu";
import { SearchIcon } from "@/components/ui/icons";
import { PendingBar } from "@/components/ui/pending-bar";

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
      {statusOptions && (
        <SelectMenu
          ariaLabel="Filtrar por estado"
          value={searchParams.get("status") ?? ""}
          onChange={(v) => updateParam("status", v)}
          className="w-auto min-w-40"
          options={[{ value: "", label: "Todos los estados" }, ...statusOptions]}
        />
      )}
      {ownerOptions && ownerOptions.length > 0 && (
        <SelectMenu
          ariaLabel="Filtrar por responsable"
          value={searchParams.get("ownerId") ?? ""}
          onChange={(v) => updateParam("ownerId", v)}
          className="w-auto min-w-40"
          options={[{ value: "", label: "Todos los responsables" }, { value: "none", label: "Sin asignar" }, ...ownerOptions]}
        />
      )}
      {tagOptions && tagOptions.length > 0 && (
        <SelectMenu
          ariaLabel="Filtrar por etiqueta"
          value={searchParams.get("tagId") ?? ""}
          onChange={(v) => updateParam("tagId", v)}
          className="w-auto min-w-40"
          options={[{ value: "", label: "Todas las etiquetas" }, ...tagOptions]}
        />
      )}
      {sortOptions && (
        <SelectMenu
          ariaLabel="Ordenar"
          value={searchParams.get("sort") ?? ""}
          onChange={(v) => updateParam("sort", v)}
          className="w-auto min-w-40"
          align="right"
          options={sortOptions.map((opt, i) => ({ value: i === 0 ? "" : opt.value, label: opt.label }))}
        />
      )}
    </div>
  );
}
