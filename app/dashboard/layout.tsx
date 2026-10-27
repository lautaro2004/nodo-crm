import { redirect } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getWorkspaceWithBusiness } from "@/modules/workspace/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { listModules } from "@/modules/custom-modules/service";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { RoleProvider } from "@/components/dashboard/role-context";
import { can, resolveAccess, toClientAccess } from "@/modules/access/service";
import { loadCrmBillingState } from "@/modules/billing/access";
import { comboDiscountPercent, listCrmPlans, listNexoPlansForCombo } from "@/modules/billing/plans";
import { BillingBanner } from "@/components/billing/billing-banner";
import { BlockedScreen } from "@/components/billing/blocked-screen";
import { CheckoutPanel } from "@/components/billing/checkout-panel";

// Único lugar que decide "explícitamente" qué pasa cuando falta Business o
// Workspace (nunca se crean solos, ver docs/architecture/crm-fase3-core.md,
// Fase 3A): sin Business o sin Workspace, se redirige a /onboarding — el
// dashboard nunca se renderiza a medias.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await resolveWorkspaceContext();

  if (ctx.status === "unauthenticated") redirect("/login");
  if (ctx.status === "no_business" || ctx.status === "no_workspace") redirect("/onboarding");
  if (ctx.status === "no_access") {
    return (
      <main className="app-backdrop flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-[var(--radius-glass)] p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">No tenés acceso a Nodo</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sos parte de <strong>{ctx.businessName}</strong>, pero todavía no te habilitaron Nodo. Pedile acceso al dueño o a un
            administrador del negocio.
          </p>
        </div>
      </main>
    );
  }

  // Suscripción: sin plan con Nodo (o con el pago vencido más allá de la
  // gracia) se muestra la pantalla de planes/regularización. Los datos no se
  // tocan. Ver lib/workspace.ts y modules/billing/access.ts.
  if (ctx.status === "billing_blocked") {
    const [plans, nexoPlans] = await Promise.all([listCrmPlans(), listNexoPlansForCombo()]);
    return (
      <BlockedScreen
        businessName={ctx.businessName}
        reason={ctx.reason}
        isOwner={ctx.role === "owner"}
        plans={plans}
        checkout={ctx.role === "owner" ? <CheckoutPanel plans={plans} nexoPlans={nexoPlans} comboPct={comboDiscountPercent()} /> : undefined}
      />
    );
  }

  const workspace = await getWorkspaceWithBusiness(ctx.businessId);
  if (!workspace) redirect("/onboarding");

  // Fase de módulos configurables: el nombre visible de "Oportunidades"
  // depende del Workspace (ver modules/workspace/module-config.ts) — se
  // resuelve acá, una sola vez, y se pasa hacia abajo en vez de que cada
  // ítem de navegación lo vuelva a resolver.
  const [opportunityLabel, modules] = await Promise.all([getModuleLabel(ctx.businessId, "opportunity"), listModules(ctx.businessId)]);
  // Permisos de Nodo: el menú solo muestra los módulos que la persona puede
  // ver (las páginas y la API lo vuelven a validar).
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  const customModules = modules.filter((m) => can(access, `cm:${m.id}`, "view")).map((m) => ({ key: m.key, label: m.labelPlural, icon: m.icon }));
  const MODULE_ENTITY: Record<string, string> = { companies: "company", contacts: "contact", leads: "lead", opportunities: "opportunity", tasks: "task" };
  const activeModules = workspace.activeModules.filter((k) => !MODULE_ENTITY[k] || can(access, MODULE_ENTITY[k], "view"));

  return (
    <RoleProvider role={ctx.role} access={toClientAccess(access)}>
    <div className="app-backdrop flex min-h-screen">
      <Sidebar businessName={workspace.business.name} activeModules={activeModules} opportunityLabel={opportunityLabel} customModules={customModules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar businessName={workspace.business.name} activeModules={activeModules} opportunityLabel={opportunityLabel} customModules={customModules} />
        <BillingBanner state={await loadCrmBillingState(ctx.businessId)} canManage={ctx.role === "owner" || ctx.role === "admin"} />
        {/* Ancho: en escritorio las listas usan casi todo el espacio (más
            columnas visibles) con un tope para pantallas muy anchas; los
            formularios conservan su propio ancho de lectura (max-w-lg/2xl). */}
        <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 2xl:px-10">
          <div className="mx-auto w-full max-w-[1760px]">{children}</div>
        </main>
      </div>
    </div>
    </RoleProvider>
  );
}
