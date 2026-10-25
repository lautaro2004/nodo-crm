import { resolveWorkspaceContext } from "@/lib/workspace";
import { AdminOnly } from "@/components/team/admin-only";
import { listTags } from "@/modules/tags/service";
import { PageHeader } from "@/components/ui/primitives";
import { TagsManager } from "@/components/configuracion/tags-manager";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export default async function TagsSettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return <AdminOnly />;

  const tags = await listTags(ctx.businessId);

  return (
    <div>
      <PageHeader title="Etiquetas" description="Se pueden asignar desde la ficha de cualquier empresa, contacto, lead u oportunidad." />
      <TagsManager tags={tags} />
    </div>
  );
}
