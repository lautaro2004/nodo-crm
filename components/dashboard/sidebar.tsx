"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";
import {
  HomeIcon,
  BuildingIcon,
  UsersIcon,
  TargetIcon,
  CheckSquareIcon,
  ActivityIcon,
  CalendarIcon,
  SettingsIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
  BarChartIcon,
  BoxIcon,
  ZapIcon,
  WrenchIcon,
} from "@/components/ui/icons";
import { ModuleIcon } from "@/components/ui/module-icon";
import type { ModuleLabel } from "@/modules/workspace/module-config-shared";
import { hasRole, ROLE_LABELS, type Role } from "@/lib/permissions";
import { useAccess, useRole } from "@/components/dashboard/role-context";
import { canAdmin, type AdminPermission } from "@/lib/access";
import { CustomModuleIcon } from "@/components/custom-modules/custom-module-icon";

export interface CustomModuleNav {
  key: string;
  label: string;
  icon: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  module?: string; // si está seteado, el item se oculta cuando el módulo no está activo
  minRole?: Role; // rol mínimo para verlo (ver lib/permissions.ts)
  adminPermission?: AdminPermission; // permiso administrativo de Nodo (lib/access.ts)
}

// Agrupado en secciones (pedido explícito de la fase de pulido UX: "el
// sidebar debe soportar crecimiento futuro") — antes era una lista plana
// sin jerarquía. Los grupos reflejan módulos que YA existen, ninguno se
// agrega para "completar el menú".
//
// El item de "Oportunidades" recibe su label/ícono como parámetro (Fase
// de módulos configurables): el Workspace puede llamarlo "Ventas",
// "Casos", "Proyectos", etc. — la URL /dashboard/oportunidades NUNCA
// cambia (Fase 5: "mantener URLs internas estables"), sólo el texto.
function buildNavGroups(opportunityLabel: ModuleLabel): { label: string | null; items: NavItem[] }[] {
  return [
    { label: null, items: [{ href: "/dashboard", label: "Inicio", icon: <HomeIcon /> }] },
    {
      label: "CRM",
      items: [
        { href: "/dashboard/empresas", label: "Empresas", icon: <BuildingIcon />, module: "companies" },
        { href: "/dashboard/contactos", label: "Contactos", icon: <UsersIcon />, module: "contacts" },
        { href: "/dashboard/leads", label: "Leads", icon: <TargetIcon />, module: "leads" },
        {
          href: "/dashboard/oportunidades",
          label: opportunityLabel.labelPlural,
          icon: <ModuleIcon icon={opportunityLabel.icon} />,
          module: "opportunities",
        },
      ],
    },
    {
      label: "Trabajo",
      items: [
        { href: "/dashboard/tareas", label: "Tareas", icon: <CheckSquareIcon />, module: "tasks" },
        { href: "/dashboard/calendario", label: "Calendario", icon: <CalendarIcon /> },
        { href: "/dashboard/actividades", label: "Actividad", icon: <ActivityIcon /> },
        { href: "/dashboard/informes", label: "Informes", icon: <BarChartIcon /> },
      ],
    },
    // Lo que hace a Nodo configurable — antes enterrado en Configuración.
    // Cada item solo lo ve quien tiene el permiso administrativo que lo
    // gestiona (un vendedor no ve opciones que no puede usar).
    {
      label: "Construir",
      items: [
        { href: "/dashboard/modulos", label: "Módulos", icon: <BoxIcon />, adminPermission: "fields" },
        { href: "/dashboard/automatizaciones", label: "Automatizaciones", icon: <ZapIcon />, adminPermission: "automations" },
        { href: "/dashboard/integraciones", label: "Integraciones", icon: <WrenchIcon /> },
      ],
    },
    {
      label: "Herramientas",
      items: [
        { href: "/dashboard/buscar", label: "Búsqueda", icon: <SearchIcon /> },
        { href: "/dashboard/importar", label: "Importar", icon: <UploadIcon />, adminPermission: "import" },
      ],
    },
  ];
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(32_33_36/0.06),0_0_0_1px_rgb(32_33_36/0.05)]"
          : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
      }`}
    >
      {active && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-500" />}
      <span className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}`}>{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      <NavPending />
    </Link>
  );
}

// Indicador discreto mientras carga la sección elegida (aparece solo si la
// navegación tarda más de ~150 ms, así no parpadea en las instantáneas).
function NavPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 transition-opacity duration-200 ${pending ? "animate-pulse opacity-100 delay-150" : "opacity-0"}`}
    />
  );
}

function SidebarContent({
  businessName,
  activeModules,
  opportunityLabel,
  customModules,
  onNavigate,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
  customModules: CustomModuleNav[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const role = useRole();
  const access = useAccess();
  const navGroups = buildNavGroups(opportunityLabel);
  // Módulos creados por el negocio (Productos, Citas…), después del núcleo
  // del CRM. La URL usa la key estable del módulo.
  if (customModules.length > 0) {
    navGroups.splice(2, 0, {
      label: "Módulos",
      items: customModules.map((m) => ({ href: `/dashboard/m/${m.key}`, label: m.label, icon: <CustomModuleIcon iconName={m.icon} /> })),
    });
  }

  return (
    <div className="flex h-full flex-col" onClick={onNavigate}>
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
            {businessName.trim()[0]?.toUpperCase() ?? "·"}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Espacio de trabajo · {role === "owner" ? ROLE_LABELS[role] : access.roleName}</p>
            <p className="truncate text-sm font-semibold text-slate-900">{businessName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navGroups.map((group, i) => {
          const visibleItems = group.items.filter(
            (item) =>
              (!item.module || activeModules.includes(item.module)) &&
              (!item.minRole || hasRole(role, item.minRole)) &&
              (!item.adminPermission || canAdmin(access.policy, item.adminPermission))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label ?? `group-${i}`}>
              {group.label && (
                <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/70 p-3">
        <NavLink item={{ href: "/dashboard/configuracion", label: "Configuración", icon: <SettingsIcon /> }} pathname={pathname} />
      </div>
    </div>
  );
}

// Desktop: sidebar fija, siempre visible (lg+). Mobile/tablet: oculta por
// default, se abre como drawer controlado desde Topbar (ver
// components/dashboard/mobile-nav.tsx) — antes era un <aside w-64> fijo
// sin ninguna estrategia responsive, lo que generaba overflow horizontal
// real en pantallas chicas.
export function Sidebar({
  businessName,
  activeModules,
  opportunityLabel,
  customModules,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
  customModules: CustomModuleNav[];
}) {
  return (
    <aside className="glass-bar hidden w-64 shrink-0 border-r border-slate-200/70 lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent businessName={businessName} activeModules={activeModules} opportunityLabel={opportunityLabel} customModules={customModules} />
      </div>
    </aside>
  );
}

export function MobileSidebarDrawer({
  businessName,
  activeModules,
  opportunityLabel,
  customModules,
  open,
  onClose,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
  customModules: CustomModuleNav[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button aria-label="Cerrar menú" onClick={onClose} className="animate-overlay-in absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
      <div className="glass animate-sheet-in relative m-2 flex h-[calc(100%-1rem)] w-72 max-w-[85vw] flex-col rounded-[var(--radius-glass)]">
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onClose}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <SidebarContent
          businessName={businessName}
          activeModules={activeModules}
          opportunityLabel={opportunityLabel}
          customModules={customModules}
          onNavigate={onClose}
        />
      </div>
    </div>
  );
}
