"use client";

import Link from "next/link";
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
} from "@/components/ui/icons";
import { ModuleIcon } from "@/components/ui/module-icon";
import type { ModuleLabel } from "@/modules/workspace/module-config-shared";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  module?: string; // si está seteado, el item se oculta cuando el módulo no está activo
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
      ],
    },
    {
      label: "Herramientas",
      items: [
        { href: "/dashboard/buscar", label: "Búsqueda", icon: <SearchIcon /> },
        { href: "/dashboard/importar", label: "Importar", icon: <UploadIcon /> },
      ],
    },
  ];
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className={active ? "text-indigo-600" : "text-slate-400"}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

function SidebarContent({
  businessName,
  activeModules,
  opportunityLabel,
  onNavigate,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navGroups = buildNavGroups(opportunityLabel);

  return (
    <div className="flex h-full flex-col" onClick={onNavigate}>
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Logo />
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Negocio</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{businessName}</p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navGroups.map((group, i) => {
          const visibleItems = group.items.filter((item) => !item.module || activeModules.includes(item.module));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label ?? `group-${i}`}>
              {group.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
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

      <div className="border-t border-slate-100 p-3">
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
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent businessName={businessName} activeModules={activeModules} opportunityLabel={opportunityLabel} />
      </div>
    </aside>
  );
}

export function MobileSidebarDrawer({
  businessName,
  activeModules,
  opportunityLabel,
  open,
  onClose,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button aria-label="Cerrar menú" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onClose}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <SidebarContent businessName={businessName} activeModules={activeModules} opportunityLabel={opportunityLabel} onNavigate={onClose} />
      </div>
    </div>
  );
}
