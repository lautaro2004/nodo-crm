import { notFound } from "next/navigation";
import { AdminOnly } from "@/components/team/admin-only";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getTemplate } from "@/modules/email/templates";
import { PageHeader } from "@/components/ui/primitives";
import { TemplateForm } from "@/components/email/template-form";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return <AdminOnly />;

  const { id } = await params;
  const template = await getTemplate(ctx.businessId, id);
  if (!template) notFound();

  return (
    <div>
      <PageHeader title={template.name} backHref="/dashboard/configuracion/plantillas" />
      <TemplateForm templateId={template.id} initial={{ name: template.name, subject: template.subject, bodyHtml: template.bodyHtml }} />
    </div>
  );
}
