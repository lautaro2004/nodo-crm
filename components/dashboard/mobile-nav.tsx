"use client";

import { useState } from "react";

import { MenuIcon } from "@/components/ui/icons";
import { MobileSidebarDrawer } from "@/components/dashboard/sidebar";
import type { ModuleLabel } from "@/modules/workspace/module-config-shared";

// Botón hamburguesa + drawer, autocontenido (dueño de su propio estado
// abierto/cerrado) — se renderiza dentro de Topbar, que ya vive en el
// mismo layout que conoce businessName/activeModules. Sidebar en sí sigue
// siendo desktop-only (lg:block); en mobile/tablet este es el único punto
// de acceso a la navegación.
export function MobileNav({
  businessName,
  activeModules,
  opportunityLabel,
}: {
  businessName: string;
  activeModules: string[];
  opportunityLabel: ModuleLabel;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <MobileSidebarDrawer
        businessName={businessName}
        activeModules={activeModules}
        opportunityLabel={opportunityLabel}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
