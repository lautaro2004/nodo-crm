import { resolveWorkspaceContext } from "@/lib/workspace";
import { listCompanies } from "@/modules/companies/service";
import { PageHeader } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contacts/contact-form";

export default async function NewContactPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const companies = await listCompanies(ctx.businessId);

  return (
    <div>
      <PageHeader title="Nuevo contacto" />
      <ContactForm companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
