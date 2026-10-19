"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

// Navegación con estado pendiente real (App Router + transición).
//
// Problema que resuelve: los formularios hacían `setLoading(false)` y recién
// después `router.push(...)`. Mientras el servidor renderizaba la pantalla
// siguiente (0,5–3 s), el botón volvía a "Crear …" habilitado: parecía que no
// había pasado nada y un segundo click creaba un registro duplicado.
// Con `navigate`, `navigating` sigue en true hasta que la pantalla nueva
// reemplaza a la actual.
export function usePendingNavigation() {
  const router = useRouter();
  const [navigating, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, { refresh = true }: { refresh?: boolean } = {}) => {
      startTransition(() => {
        router.push(href);
        if (refresh) router.refresh();
      });
    },
    [router]
  );

  return { navigating, navigate };
}
