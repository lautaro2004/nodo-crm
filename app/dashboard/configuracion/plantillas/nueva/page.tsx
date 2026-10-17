import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { TemplateForm } from "@/components/email/template-form";

export default async function NewTemplatePage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  return (
    <div>
      <PageHeader title="Nueva plantilla" backHref="/dashboard/configuracion/plantillas" />
      <TemplateForm />
    </div>
  );
}
