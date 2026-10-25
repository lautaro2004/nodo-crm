import { resolveWorkspaceContext } from "@/lib/workspace";
import { listCompanies } from "@/modules/companies/service";
import { PageHeader } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contacts/contact-form";
import { can, resolveAccess } from "@/modules/access/service";
import { customFieldsForForm } from "@/modules/custom-fields/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function NewContactPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!can(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "contact", "create")) return <NoAccess what="crear registros acá" />;

  const companies = await listCompanies(ctx.businessId);

  return (
    <div>
      <PageHeader title="Nuevo contacto" />
      <ContactForm customFields={await customFieldsForForm(ctx.businessId, "contact")} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
