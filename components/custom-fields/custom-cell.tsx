import { formatCustomValue } from "@/lib/custom-fields";
import type { CustomCells } from "@/modules/custom-fields/columns";

/** Celda de una columna `cf_<id>` en las tablas de listas. */
export function CustomCell({ custom, columnKey, entityId }: { custom: CustomCells; columnKey: string; entityId: string }) {
  const column = custom.columns.get(columnKey);
  if (!column) return null;
  const text = formatCustomValue(column.type, custom.values.get(entityId)?.get(column.definitionId));
  if (!text) return <span className="text-slate-400">—</span>;
  const numeric = column.type === "number" || column.type === "currency";
  return <span className={`block max-w-56 truncate ${numeric ? "text-right tabular-nums text-slate-800" : "text-slate-600"}`}>{text}</span>;
}
