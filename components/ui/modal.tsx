"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { XIcon } from "@/components/ui/icons";

// Overlay controlado simple, sin dependencia de <dialog> nativo (soporte/
// estilo inconsistente entre navegadores) ni de una librería externa.
//
// Comportamiento:
// - Entrada animada (fondo en fade, panel con leve escala/desplazamiento);
//   la salida es inmediata para no demorar la acción del usuario.
// - Escape cierra (salvo `busy`), el foco entra al modal y vuelve al
//   elemento que lo abrió, Tab queda dentro del panel y el fondo no scrollea.
// - `busy`: durante una mutación no se puede cerrar por fondo/Escape/X, así
//   el usuario no pierde el resultado de la operación en curso.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-md",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
  busy?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Foco inicial: el primer control marcado con autoFocus/data-autofocus,
    // si no el primer campo, si no el panel.
    const first =
      panel?.querySelector<HTMLElement>("[autofocus],[data-autofocus]") ??
      panel?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled])") ??
      panel;
    first?.focus({ preventScroll: true });

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden onClick={() => !busy && onClose()} className="animate-overlay-in absolute inset-0 bg-slate-900/30 backdrop-blur-[3px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={`animate-dialog-in relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto ${maxWidth} rounded-[var(--radius-glass)] border border-white/70 bg-white/95 p-6 shadow-[var(--shadow-lift)] outline-none supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="mt-1 whitespace-pre-line text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={busy}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
