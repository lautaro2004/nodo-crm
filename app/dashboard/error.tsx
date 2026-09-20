"use client";

import { useEffect } from "react";

import { Button, EmptyState } from "@/components/ui/primitives";
import { AlertTriangleIcon } from "@/components/ui/icons";

// Red de seguridad para /dashboard/** — antes un error no controlado
// rompía en un overlay de Next (dev) o una pantalla en blanco (prod), sin
// ninguna forma de recuperarse sin recargar manualmente. error.tsx es un
// Client Component por requisito de Next.js (necesita manejar el evento
// de reset).
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard] Error no controlado:", error);
  }, [error]);

  return (
    <EmptyState
      title="Algo salió mal"
      description="No pudimos cargar esta pantalla. Podés intentar de nuevo — si el problema sigue, probá recargar la página."
      action={
        <Button
          onClick={() => reset()}
          className="inline-flex items-center gap-2"
        >
          <AlertTriangleIcon className="h-4 w-4" />
          Reintentar
        </Button>
      }
    />
  );
}
