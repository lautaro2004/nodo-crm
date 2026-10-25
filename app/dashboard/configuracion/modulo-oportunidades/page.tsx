import { resolveWorkspaceContext } from "@/lib/workspace";
import { AdminOnly } from "@/components/team/admin-only";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ModuleLabelForm } from "@/components/configuracion/module-label-form";
import { canAdminister, resolveAccess } from "@/modules/access/service";

// URL interna estable ("modulo-oportunidades") aunque el negocio lo haya
// renombrado a "Ventas"/"Casos"/etc. — mismo criterio que
// /dashboard/oportunidades en el resto de la app.
export default async function ModuleLabelSettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return <AdminOnly />;

  const moduleLabel = await getModuleLabel(ctx.businessId, "opportunity");

  return (
    <div>
      <PageHeader
        title="Nombre del módulo de Oportunidades"
        description="Adaptá el nombre y el ícono a tu negocio — el resto de Nodo sigue funcionando igual."
        backHref="/dashboard/configuracion"
      />
      <Card className="p-4">
        <ModuleLabelForm moduleLabel={moduleLabel} />
      </Card>
    </div>
  );
}
