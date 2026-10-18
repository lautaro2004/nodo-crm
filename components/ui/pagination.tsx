import Link from "next/link";

// Paginación por query string (`page`), conservando el resto de los
// parámetros (filtros, columnas, orden).
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | string[] | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300";
  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btn} rel="prev">
            ← Anterior
          </Link>
        ) : (
          <span className={`${btn} opacity-40`}>← Anterior</span>
        )}
        <span className="inline-flex h-8 items-center px-1">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={btn} rel="next">
            Siguiente →
          </Link>
        ) : (
          <span className={`${btn} opacity-40`}>Siguiente →</span>
        )}
      </div>
    </nav>
  );
}
