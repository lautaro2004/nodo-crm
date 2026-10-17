import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  return (
    <div>
      <PageHeader title="Importar" description="Subí un Excel o CSV y cargalo en Contactos, Empresas o Leads." />
      <ImportWizard />
    </div>
  );
}
