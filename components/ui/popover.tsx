"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Popover mínimo (sin librería): botón + panel de vidrio, se cierra con
// click afuera o Escape. `children` puede ser una función que recibe
// `close` para cerrarlo desde adentro (ej. al aplicar filtros).
export function Popover({
  label,
  icon,
  badge,
  align = "left",
  width = "w-80",
  active,
  children,
}: {
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  align?: "left" | "right";
  width?: string;
  active?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-medium shadow-[var(--shadow-card)] transition-[border-color,box-shadow,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          active || open ? "border-slate-300 bg-white text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
        }`}
      >
        {icon}
        {label}
        {badge !== undefined && badge !== 0 && (
          <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold leading-5 text-slate-900">{badge}</span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`glass animate-pop-in absolute top-12 z-40 max-h-[70vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl p-4 ${width} ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
