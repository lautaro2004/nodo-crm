"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Forma canónica de la URL de una lista para guardar y comparar: sin la
// página (no es parte de "la vista"), sin parámetros vacíos y en orden
// estable. Así "display=list&view=x" y "view=x&display=list" son lo mismo.
function canonical(input: string | URLSearchParams): string {
  const params = new URLSearchParams(input);
  params.delete("page");
  const entries = Array.from(params.entries()).filter(([, v]) => v !== "");
  entries.sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

function save(entity: string, value: string) {
  void fetch("/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: `list:${entity}`, value }),
    // keepalive: el guardado sobrevive aunque la persona ya se esté yendo
    // a otro módulo (la página se desmonta en el medio).
    keepalive: true,
  }).catch(() => null);
}

// Recuerda la vista de una lista por usuario y módulo (crm.UserPreference):
// - Al MONTAR sin parámetros (se entró al módulo desde el menú, otro módulo
//   o recargando), aplica `restore` (la última vista guardada, ya validada
//   en el servidor por lib/views/remember.ts).
// - Cada cambio posterior de la URL (salvo la página) se guarda como
//   preferencia. Limpiar los filtros dentro de la lista NO remonta este
//   componente, así que no se "restaura" lo que la persona acaba de quitar.
//
// Tres casos que la versión anterior perdía:
// - Mientras se aplica la restauración la URL todavía está vacía: ese
//   estado intermedio NO se guarda (antes, el doble montaje de React en
//   desarrollo guardaba "vacío" y borraba la preferencia).
// - Si la persona sale del módulo antes de que venza la espera del
//   guardado, se guarda igual en vez de cancelarse.
// - Se compara en forma canónica (el orden de los parámetros no cuenta).
export function ListPreferenceSync({ entity, restore }: { entity: string; restore?: string | null }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  const restoring = useRef<string | null>(null);
  const pending = useRef<string | null>(null);

  // Al desmontar (cambio de módulo), lo pendiente se guarda ya.
  useEffect(() => {
    return () => {
      if (pending.current !== null) save(entity, pending.current);
      pending.current = null;
    };
  }, [entity]);

  useEffect(() => {
    const value = canonical(sp);

    // Primer render del módulo sin parámetros y con una vista guardada:
    // restaurarla. Idempotente (el doble montaje de desarrollo no la pisa).
    if (last.current === null && !value && restore) {
      if (restoring.current === null) {
        restoring.current = canonical(restore);
        router.replace(`${pathname}?${restore}`);
      }
      return;
    }

    // Esperando que la URL llegue a la vista restaurada: el estado
    // intermedio (URL vacía) no se guarda. Si llegó, queda como base sin
    // guardar nada. Si la persona ya eligió otra cosa en el medio, eso sí
    // se guarda (sigue al flujo normal).
    if (restoring.current !== null) {
      if (!value) return;
      const reached = value === restoring.current;
      restoring.current = null;
      if (reached) {
        last.current = value;
        return;
      }
    }

    if (last.current === value) return;
    const first = last.current === null;
    last.current = value;
    // Montar sin parámetros y sin nada guardado: no hay nada que recordar.
    if (first && !value) return;

    pending.current = value;
    const timer = setTimeout(() => {
      if (pending.current === null) return;
      save(entity, pending.current);
      pending.current = null;
    }, 300);
    return () => clearTimeout(timer);
  }, [sp, entity, restore, router, pathname]);

  return null;
}
