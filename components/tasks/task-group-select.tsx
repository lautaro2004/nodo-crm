"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Select } from "@/components/ui/primitives";

const GROUP_OPTIONS = [
  { value: "", label: "Sin agrupar" },
  { value: "owner", label: "Responsable" },
  { value: "priority", label: "Prioridad" },
  { value: "related", label: "Relacionado" },
];

// Solo aplica a la vista Lista — Kanban ya está, por naturaleza, agrupado
// por estado (sus columnas). Agrupación 100% frontend: reorganiza el
// mismo array que ya trae `listTasks` filtrado, sin pedir nada nuevo al
// backend.
export function TaskGroupSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("group", value);
    else params.delete("group");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select defaultValue={searchParams.get("group") ?? ""} onChange={(e) => handleChange(e.target.value)} className="w-44">
      {GROUP_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.value ? `Agrupar por: ${o.label}` : o.label}
        </option>
      ))}
    </Select>
  );
}
