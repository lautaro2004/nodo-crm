import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { listModules } from "@/modules/custom-modules/service";
import { prisma } from "@/lib/prisma";
import { ModulesAdmin } from "@/components/custom-modules/modules-admin";
import { MODULE_TEMPLATES, MAX_CUSTOM_MODULES } from "@/lib/custom-modules";

export default async function ModulesSettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  const modules = await listModules(ctx.businessId, { includeArchived: true });
  const counts = await prisma.customRecord.groupBy({
    by: ["moduleId"],
    where: { businessId: ctx.businessId, archivedAt: null },
    _count: { _all: true },
  });
  const countBy = new Map(counts.map((c) => [c.moduleId, c._count._all]));

  return (
    <div>
      <PageHeader
        title="Módulos"
        description="Creá módulos propios para lo que gestiona tu negocio (productos, citas, propiedades…). Conviven con Leads, Contactos, Empresas y Oportunidades."
        backHref="/dashboard/configuracion"
        backLabel="Configuración"
      />
      <ModulesAdmin
        max={MAX_CUSTOM_MODULES}
        templates={MODULE_TEMPLATES.map((t) => ({ id: t.id, labelPlural: t.labelPlural, labelSingular: t.labelSingular, description: t.description, icon: t.icon, fields: t.fields.map((f) => f.label) }))}
        modules={modules.map((m) => ({
          id: m.id,
          key: m.key,
          labelPlural: m.labelPlural,
          description: m.description,
          icon: m.icon,
          archived: !!m.archivedAt,
          records: countBy.get(m.id) ?? 0,
        }))}
      />
    </div>
  );
}
