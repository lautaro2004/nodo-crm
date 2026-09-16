import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getWorkspaceWithBusiness } from "@/modules/workspace/service";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ModulesToggle } from "@/components/configuracion/modules-toggle";
import { INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";

const SETTINGS_LINKS = [
  { href: "/dashboard/configuracion/etiquetas", label: "Etiquetas" },
  { href: "/dashboard/configuracion/campos-personalizados", label: "Campos personalizados" },
  { href: "/dashboard/configuracion/estados", label: "Estados (Leads / Empresas)" },
  { href: "/dashboard/oportunidades/pipelines", label: "Pipelines" },
];

export default async function SettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const workspace = await getWorkspaceWithBusiness(ctx.businessId);
  if (!workspace) return null;

  return (
    <div>
      <PageHeader title="Configuración" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Tu negocio</h2>
          <p className="text-sm text-slate-600">{workspace.business.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            Rubro: {workspace.industryTemplate ? INDUSTRY_TEMPLATES[workspace.industryTemplate as IndustryKey]?.label : "Genérico"}
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Módulos activos</h2>
          <ModulesToggle activeModules={workspace.activeModules} />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Personalización</h2>
          <ul className="space-y-1">
            {SETTINGS_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-slate-700 hover:underline">
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
