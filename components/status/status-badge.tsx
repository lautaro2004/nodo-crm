import { resolveStatusColor } from "@/lib/status-colors";

// Chip de estado/etapa con el color configurado (paleta de 10 colores).
// Punto + texto: el color nunca es el único portador de información — el
// label siempre está, así sigue siendo legible para daltonismo/impresión.
export function StatusBadge({
  label,
  color,
  className = "",
}: {
  label: string;
  color: string | null | undefined;
  className?: string;
}) {
  const c = resolveStatusColor(color);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${c.badge} ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function StatusDot({ color, className = "" }: { color: string | null | undefined; className?: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${resolveStatusColor(color).dot} ${className}`} />;
}
