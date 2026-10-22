import { Skeleton } from "@/components/ui/primitives";

// Skeletons de página para los loading.tsx del dashboard. Imitan la
// estructura real (encabezado + barra + tabla / detalle en 2 columnas /
// formulario) para que al llegar el contenido no haya saltos de layout.
//
// Aparecen con un leve retraso (`skeleton-delay`): si la página llega en
// menos de ~120 ms no se ve ningún parpadeo.

function Header({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-[70vw]" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div className="skeleton-delay" aria-busy="true" aria-label="Cargando">
      <Header />
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-10 min-w-56 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex gap-4 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          {[32, 20, 16, 16].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${w}%` }} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-50 px-4 py-3.5 last:border-0">
            <Skeleton className="h-4 w-[32%]" />
            <Skeleton className="h-4 w-[20%]" />
            <Skeleton className="h-5 w-[12%] rounded-full" />
            <Skeleton className="h-4 w-[16%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="skeleton-delay" aria-busy="true" aria-label="Cargando">
      <Skeleton className="mb-3 h-4 w-20" />
      <Header actions={2} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <Skeleton className="mb-4 h-4 w-28" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-36 max-w-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <Skeleton className="mb-4 h-4 w-24" />
            <Skeleton className="mb-2 h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <Skeleton className="mb-4 h-4 w-24" />
              <Skeleton className="mb-2 h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="skeleton-delay" aria-busy="true" aria-label="Cargando">
      <Skeleton className="mb-3 h-4 w-20" />
      <Header actions={0} />
      <div className="max-w-lg space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  );
}
