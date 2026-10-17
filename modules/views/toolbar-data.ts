import type { OkWorkspaceContext } from "@/lib/workspace";
import { LEAD_SOURCE_LABELS, OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { listWorkspaceMembers, type WorkspaceMember } from "@/modules/business/members";
import { listCustomFieldDefinitions } from "@/modules/custom-fields/service";
import { listTags } from "@/modules/tags/service";
import { listStatusOptions, type StatusOption } from "@/modules/status-definitions/service";
import { canManageSharedViews, listViews, type ViewEntityType } from "@/modules/views/service";
import type { FilterConfig, SavedViewItem } from "@/components/views/list-toolbar";

// Datos que necesita la barra de lista (opciones de filtros + vistas
// guardadas visibles para este usuario). Server-only.
export async function getToolbarData(ctx: OkWorkspaceContext, entity: ViewEntityType) {
  const [members, tags, customFields, views, leadStatuses] = await Promise.all([
    listWorkspaceMembers(ctx.businessId),
    listTags(ctx.businessId),
    listCustomFieldDefinitions(ctx.businessId, entity),
    listViews(ctx.businessId, entity, ctx),
    entity === "lead" ? listStatusOptions(ctx.businessId, "lead") : Promise.resolve([] as StatusOption[]),
  ]);
  const canShare = canManageSharedViews(ctx.role);

  const filters: FilterConfig = {
    owners: members.map((m) => ({ value: m.userId, label: m.name || m.email })),
    tags: tags.map((t) => ({ value: t.id, label: t.name })),
    customFields: customFields.map((c) => ({ id: c.id, label: c.label, options: c.options })),
    ...(entity === "lead"
      ? {
          statuses: leadStatuses.map((s) => ({ value: s.key, label: s.label })),
          sources: Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
          dateFields: [
            { value: "created", label: "Fecha de creación" },
            { value: "updated", label: "Última actualización" },
            { value: "followup", label: "Último seguimiento" },
          ],
          followUp: true,
        }
      : {
          statuses: Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          dateFields: [
            { value: "created", label: "Fecha de creación" },
            { value: "updated", label: "Última actualización" },
            { value: "closed", label: "Fecha de cierre" },
          ],
          pipelineExtras: true,
        }),
  };

  const savedViews: SavedViewItem[] = views.map((v) => ({
    id: v.id,
    name: v.name,
    params: v.params,
    shared: v.shared,
    canEdit: v.shared ? canShare : v.createdBy === ctx.userId,
  }));

  return { filters, savedViews, canShare, members, leadStatuses };
}

export function memberNames(members: WorkspaceMember[]) {
  return new Map(members.map((m) => [m.userId, m.name || m.email]));
}
