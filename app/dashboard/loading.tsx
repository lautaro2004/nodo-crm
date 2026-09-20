import { Skeleton } from "@/components/ui/primitives";

// Un único loading.tsx para todo /dashboard/** (convención de Next.js —
// se aplica en cada navegación entre segmentos mientras el server
// component de la página siguiente resuelve sus datos). Antes no existía
// ninguno: la navegación entre secciones no mostraba ningún feedback de
// carga. Genérico a propósito (no una skeleton distinta por pantalla) —
// cubre el caso común de "título + barra de acciones + lista" sin
// necesitar un archivo por ruta.
export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mb-4 h-10 w-full max-w-md" />
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
