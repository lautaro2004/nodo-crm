import { resolveStatusColor } from "@/lib/status-colors";

// Gráficos simples (HTML/SVG, sin librería) para Informes. Una serie por
// gráfico (un solo color, el texto siempre en tinta neutra), tooltip
// nativo por barra y la tabla con los mismos datos al lado o debajo.

const fmtKey = (key: string, unit: "day" | "week") => {
  const [, m, d] = key.split("-");
  return unit === "week" ? `sem ${d}/${m}` : `${d}/${m}`;
};

export function TimeBars({
  points,
  unit,
  label,
  barClass = "bg-brand-500",
}: {
  points: { key: string; count: number }[];
  unit: "day" | "week";
  label: string;
  barClass?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = Math.ceil(points.length / 8);
  return (
    <figure aria-label={label}>
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`${label}: ${points.map((p) => `${fmtKey(p.key, unit)} ${p.count}`).join(", ")}`}>
        {points.map((p) => (
          <div key={p.key} className="group relative flex h-full flex-1 items-end" title={`${fmtKey(p.key, unit)}: ${p.count}`}>
            <div
              className={`w-full rounded-t-[4px] ${barClass} opacity-90 transition-opacity group-hover:opacity-100`}
              style={{ height: p.count === 0 ? 2 : `${(p.count / max) * 100}%`, opacity: p.count === 0 ? 0.25 : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-slate-200 pt-1 text-[10px] tabular-nums text-slate-500">
        {points.map((p, i) => (
          <span key={p.key} className="flex-1 truncate text-center">
            {i % step === 0 ? fmtKey(p.key, unit) : ""}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export function HBars({
  rows,
  valueLabel = (n: number) => String(n),
  barClass = "bg-slate-700",
  empty = "Sin datos en el período.",
}: {
  rows: { label: string; value: number; color?: string | null; hint?: string }[];
  valueLabel?: (n: number) => string;
  barClass?: string;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${valueLabel(r.value)}${r.hint ? ` · ${r.hint}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700">
              {r.color !== undefined && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${resolveStatusColor(r.color).dot}`} />}
              {r.label}
            </span>
            <span className="shrink-0 tabular-nums font-medium text-slate-900">
              {valueLabel(r.value)}
              {r.hint && <span className="ml-1.5 text-xs font-normal text-slate-500">{r.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${r.color !== undefined ? resolveStatusColor(r.color).bar : barClass}`}
              style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
