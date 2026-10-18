import { customColumns, isCustomColumn, type CustomColumnDef } from "@/lib/views/columns";
import { getCustomValuesForEntities } from "@/modules/custom-fields/service";

export interface CustomCells {
  /** Columnas personalizadas por key (`cf_<id>`), para encabezado y formato. */
  columns: Map<string, CustomColumnDef>;
  /** entityId → definitionId → valor guardado. */
  values: Map<string, Map<string, string>>;
}

// Carga SOLO los valores de las columnas personalizadas visibles y de los
// registros de la página (una consulta), para listas y CSV.
export async function loadCustomCells(
  businessId: string,
  definitions: { id: string; label: string; type: string }[],
  visibleColumns: string[],
  entityIds: string[]
): Promise<CustomCells> {
  const columns = new Map(customColumns(definitions).map((c) => [c.key, c]));
  const definitionIds = visibleColumns.filter(isCustomColumn).flatMap((k) => (columns.has(k) ? [columns.get(k)!.definitionId] : []));
  const values = await getCustomValuesForEntities(businessId, definitionIds, entityIds);
  return { columns, values };
}
