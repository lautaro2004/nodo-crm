"use client";

import type { ReactNode } from "react";

import { XIcon } from "@/components/ui/icons";

// Overlay controlado simple, sin dependencia de <dialog> nativo (soporte/
// estilo inconsistente entre navegadores) ni de una librería externa. En
// uso real desde la Fase 5 (wizard de conversión de Lead) — el botón de
// cerrar explícito (antes solo se cerraba clickeando el fondo, poco
// descubrible) se agrega en esta fase de pulido UX.
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[calc(100vh-2rem)] w-full overflow-y-auto ${maxWidth} rounded-[var(--radius-glass)] border border-white/70 bg-white/95 p-6 shadow-[var(--shadow-lift)] supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : <span />}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
