import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getContact } from "@/modules/contacts/service";
import { listCompanies } from "@/modules/companies/service";
import { PageHeader } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contacts/contact-form";
import { can, canSeeRecord, resolveAccess } from "@/modules/access/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const [contact, companies] = await Promise.all([getContact(ctx.businessId, id), listCompanies(ctx.businessId)]);
  if (!contact) notFound();
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (!canSeeRecord(access, "contact", contact)) notFound();
  if (!can(access, "contact", "edit")) return <NoAccess what="editar este registro" />;

  return (
    <div>
      <PageHeader title={`Editar — ${contact.name}`} />
      <ContactForm
        contactId={contact.id}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          name: contact.name,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          companyId: contact.companyId ?? "",
        }}
      />
    </div>
  );
}
