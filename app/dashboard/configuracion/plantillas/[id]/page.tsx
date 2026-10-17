import { notFound } from "next/navigation";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getTemplate } from "@/modules/email/templates";
import { PageHeader } from "@/components/ui/primitives";
import { TemplateForm } from "@/components/email/template-form";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

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
