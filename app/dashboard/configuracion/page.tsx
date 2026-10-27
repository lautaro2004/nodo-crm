import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getWorkspaceWithBusiness } from "@/modules/workspace/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ModulesToggle } from "@/components/configuracion/modules-toggle";
import { INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";
import { hasRole, ROLE_LABELS } from "@/lib/permissions";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export default async function SettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [workspace, moduleLabel] = await Promise.all([
    getWorkspaceWithBusiness(ctx.businessId),
    getModuleLabel(ctx.businessId, "opportunity"),
  ]);
  if (!workspace) return null;

  const isAdmin = hasRole(ctx.role, "admin");
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  // `allowed`: rol de equipo (gestión del equipo y permisos) o permiso
  // administrativo de Nodo (lib/access.ts). Las APIs lo exigen igual.
  const ALL_LINKS = [
    { href: "/dashboard/configuracion/equipo", label: "Equipo (invitar, roles y acceso a Nodo / Nexo)", allowed: isAdmin },
    { href: "/dashboard/configuracion/suscripcion", label: "Suscripción (plan, usuarios y contratación)", allowed: isAdmin },
    { href: "/dashboard/configuracion/permisos", label: "Equipos y permisos (roles, excepciones, jerarquías)", allowed: isAdmin },
    { href: "/dashboard/configuracion/etiquetas", label: "Etiquetas", allowed: canAdminister(access, "settings") },
    { href: "/dashboard/configuracion/campos-personalizados", label: "Campos personalizados", allowed: canAdminister(access, "fields") },
    { href: "/dashboard/configuracion/estados", label: "Estados (Leads / Empresas)", allowed: canAdminister(access, "settings") },
    { href: "/dashboard/oportunidades/pipelines", label: "Pipelines", allowed: canAdminister(access, "settings") },
    { href: "/dashboard/configuracion/modulo-oportunidades", label: `Nombre del módulo (hoy: "${moduleLabel.labelPlural}")`, allowed: canAdminister(access, "settings") },
    { href: "/dashboard/configuracion/email", label: "Email (remitente y proveedor)", allowed: canAdminister(access, "settings") },
    { href: "/dashboard/configuracion/plantillas", label: "Plantillas de email", allowed: canAdminister(access, "settings") },
  ];
  const SETTINGS_LINKS = ALL_LINKS.filter((l) => l.allowed);

  return (
    <div>
      <PageHeader title="Configuración" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Tu negocio</h2>
          <p className="text-sm text-slate-600">{workspace.business.name}</p>
          <p className="mt-1 text-xs text-slate-500">Tu rol: {ROLE_LABELS[ctx.role]}</p>
          <p className="mt-1 text-xs text-slate-400">
            Rubro: {workspace.industryTemplate ? INDUSTRY_TEMPLATES[workspace.industryTemplate as IndustryKey]?.label : "Genérico"}
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Módulos activos</h2>
          {isAdmin ? (
            <ModulesToggle activeModules={workspace.activeModules} opportunityLabelPlural={moduleLabel.labelPlural} />
          ) : (
            <p className="text-sm text-slate-500">Los módulos los activa el dueño o un administrador.</p>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Personalización</h2>
          {/* Módulos, Automatizaciones e Integraciones tienen sección propia
              en el menú ("Construir"); acá quedan los ajustes de base. */}
          <p className="mb-3 text-xs text-slate-500">
            Módulos, Automatizaciones e Integraciones ahora están en el menú, en la sección Construir.
          </p>
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
