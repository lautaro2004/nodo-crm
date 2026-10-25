"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Recuerda la vista de una lista por usuario y módulo:
// - Al MONTAR sin parámetros (se entró al módulo desde el menú, otro módulo
//   o recargando), aplica `restore` (la última vista guardada, ya validada
//   en el servidor por lib/views/remember.ts).
// - Cada cambio posterior de la URL (salvo la página) se guarda como
//   preferencia. Limpiar los filtros dentro de la lista NO remonta este
//   componente, así que no se "restaura" lo que la persona acaba de quitar.
export function ListPreferenceSync({ entity, restore }: { entity: string; restore?: string | null }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(sp.toString());
    params.delete("page");
    const entries = Array.from(params.entries()).filter(([, v]) => v !== "");
    entries.sort(([a], [b]) => a.localeCompare(b));
    const value = new URLSearchParams(entries).toString();
    const first = last.current === null;
    if (first && !value && restore) {
      last.current = restore;
      router.replace(`${pathname}?${restore}`);
      return;
    }
    if (last.current === value) return;
    last.current = value;
    // Montar sin parámetros y sin nada guardado: no hay nada que recordar.
    if (first && !value) return;
    const timer = setTimeout(() => {
      void fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: `list:${entity}`, value }),
        keepalive: true,
      }).catch(() => null);
    }, 300);
    return () => clearTimeout(timer);
  }, [sp, entity, restore, router, pathname]);

  return null;
}
