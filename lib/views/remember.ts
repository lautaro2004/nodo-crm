import type { OkWorkspaceContext } from "@/lib/workspace";
import { normalizeViewParams } from "@/lib/views/presets";
import { prisma } from "@/lib/prisma";
import { getPreference } from "@/modules/preferences/service";

type SP = Record<string, string | string[] | undefined>;

/**
 * Última vista guardada de una lista (Lista/Kanban, vista guardada,
 * filtros, columnas y orden) para restaurarla cuando se ENTRA al módulo sin
 * parámetros. Server-only. Devuelve el query string a aplicar, o null.
 *
 * La restauración la hace el cliente (components/views/list-preference-sync.tsx)
 * al MONTAR la lista: así "entrar al módulo" (menú, otro módulo, recarga) se
 * distingue de "limpiar los filtros dentro de la lista" (no remonta), sin
 * depender de cachés de navegación. Las preferencias viven en
 * crm.UserPreference: por usuario y módulo, sobreviven recargas y sesiones.
 *
 * Si la vista guardada ya no existe (o dejó de estar visible), se descarta y
 * se usa la vista por defecto del módulo, conservando Lista/Kanban y columnas.
 */
export async function getRestorableListParams(ctx: OkWorkspaceContext, entity: string, sp: SP, presetIds: string[] = []): Promise<string | null> {
  if (Object.values(sp).some((v) => v !== undefined && v !== "")) return null;
  const stored = await getPreference<string>(ctx.businessId, ctx.userId, `list:${entity}`);
  if (!stored || typeof stored !== "string") return null;
  const params = new URLSearchParams(stored);
  const viewId = params.get("view");
  if (viewId && !presetIds.includes(viewId)) {
    const exists = await prisma.savedView.count({
      where: { id: viewId, businessId: ctx.businessId, entityType: entity, OR: [{ shared: true }, { createdBy: ctx.userId }] },
    });
    if (!exists) {
      const keep = new URLSearchParams();
      for (const k of ["display", "cols", "pipelineId"]) {
        const v = params.get(k);
        if (v) keep.set(k, v);
      }
      return keep.toString() || null;
    }
  }
  const qs = normalizeViewParams(params);
  const withView = viewId ? `${qs ? `${qs}&` : ""}view=${encodeURIComponent(viewId)}` : qs;
  return withView || null;
}
