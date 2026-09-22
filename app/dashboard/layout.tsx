import { redirect } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getWorkspaceWithBusiness } from "@/modules/workspace/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

// Único lugar que decide "explícitamente" qué pasa cuando falta Business o
// Workspace (nunca se crean solos, ver docs/architecture/crm-fase3-core.md,
// Fase 3A): sin Business o sin Workspace, se redirige a /onboarding — el
// dashboard nunca se renderiza a medias.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await resolveWorkspaceContext();

  if (ctx.status === "unauthenticated") redirect("/login");
  if (ctx.status === "no_business" || ctx.status === "no_workspace") redirect("/onboarding");

  const workspace = await getWorkspaceWithBusiness(ctx.businessId);
  if (!workspace) redirect("/onboarding");

  // Fase de módulos configurables: el nombre visible de "Oportunidades"
  // depende del Workspace (ver modules/workspace/module-config.ts) — se
  // resuelve acá, una sola vez, y se pasa hacia abajo en vez de que cada
  // ítem de navegación lo vuelva a resolver.
  const opportunityLabel = await getModuleLabel(ctx.businessId, "opportunity");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar businessName={workspace.business.name} activeModules={workspace.activeModules} opportunityLabel={opportunityLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar businessName={workspace.business.name} activeModules={workspace.activeModules} opportunityLabel={opportunityLabel} />
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
