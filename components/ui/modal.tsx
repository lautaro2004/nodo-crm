"use client";

import type { ReactNode } from "react";

// Disponible para uso futuro (ver crm-fase3-ui.md, "Componentes creados") —
// ningún flujo existente lo necesitaba todavía (todos los formularios de
// creación/edición viven en su propia página, no en un modal), así que no
// se forzó su adopción en ningún CRUD existente. Overlay controlado simple,
// sin dependencia de <dialog> nativo (soporte/estilo inconsistente entre
// navegadores) ni de una librería externa.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {title && <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
