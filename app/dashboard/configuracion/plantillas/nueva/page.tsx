import { resolveWorkspaceContext } from "@/lib/workspace";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { TemplateForm } from "@/components/email/template-form";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export default async function NewTemplatePage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return <AdminOnly />;

  return (
    <div>
      <PageHeader title="Nueva plantilla" backHref="/dashboard/configuracion/plantillas" />
      <TemplateForm />
    </div>
  );
}
