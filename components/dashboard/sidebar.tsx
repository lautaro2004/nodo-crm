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
  TrendingUpIcon,
  CheckSquareIcon,
  ActivityIcon,
  SettingsIcon,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  module?: string; // si está seteado, el item se oculta cuando el módulo no está activo
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: <HomeIcon /> },
  { href: "/dashboard/empresas", label: "Empresas / Clientes", icon: <BuildingIcon />, module: "companies" },
  { href: "/dashboard/contactos", label: "Contactos", icon: <UsersIcon />, module: "contacts" },
  { href: "/dashboard/leads", label: "Leads", icon: <TargetIcon />, module: "leads" },
  { href: "/dashboard/oportunidades", label: "Oportunidades", icon: <TrendingUpIcon />, module: "opportunities" },
  { href: "/dashboard/tareas", label: "Tareas", icon: <CheckSquareIcon />, module: "tasks" },
  { href: "/dashboard/actividades", label: "Actividades", icon: <ActivityIcon /> },
];

export function Sidebar({
  businessName,
  activeModules,
}: {
  businessName: string;
  activeModules: string[];
}) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => !item.module || activeModules.includes(item.module));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Logo />
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Negocio</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{businessName}</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={active ? "text-indigo-600" : "text-slate-400"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <Link
          href="/dashboard/configuracion"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname.startsWith("/dashboard/configuracion")
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <span className={pathname.startsWith("/dashboard/configuracion") ? "text-indigo-600" : "text-slate-400"}>
            <SettingsIcon />
          </span>
          Configuración
        </Link>
      </div>
    </aside>
  );
}
