import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { ImportWizard } from "@/components/import/import-wizard";
import { listModules } from "@/modules/custom-modules/service";

export default async function ImportPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  const modules = await listModules(ctx.businessId);

  return (
    <div>
      <PageHeader title="Importar" description="Subí un Excel o CSV y cargalo en Contactos, Empresas, Leads o tus módulos propios." />
      <ImportWizard customModules={modules.map((m) => ({ id: m.id, key: m.key, labelPlural: m.labelPlural, labelSingular: m.labelSingular }))} />
    </div>
  );
}
