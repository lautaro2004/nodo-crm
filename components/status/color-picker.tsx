"use client";

import { useEffect, useRef, useState } from "react";

import { STATUS_COLORS, STATUS_COLOR_KEYS, resolveStatusColorKey, type StatusColorKey } from "@/lib/status-colors";

// Grilla de los 10 colores como radio group accesible (flechas + Enter/
// Espacio vía inputs nativos). Cada muestra lleva nombre y sugerencia de
// uso en el tooltip / aria-label.
export function ColorSwatches({
  value,
  onChange,
  name,
}: {
  value: string | null | undefined;
  onChange: (key: StatusColorKey) => void;
  name: string;
}) {
  const current = resolveStatusColorKey(value);
  return (
    <div role="radiogroup" aria-label="Color" className="grid grid-cols-5 gap-1.5">
      {STATUS_COLOR_KEYS.map((key) => {
        const c = STATUS_COLORS[key];
        const selected = key === current;
        return (
          <label
            key={key}
            title={`${c.label} — ${c.hint}`}
            className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-shadow ${
              selected ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-white" : "hover:ring-2 hover:ring-slate-300 hover:ring-offset-1"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={selected}
              onChange={() => onChange(key)}
              className="peer sr-only"
              aria-label={`${c.label} (${c.hint})`}
            />
            <span className={`h-6 w-6 rounded-full ${c.dot} shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2`} />
          </label>
        );
      })}
    </div>
  );
}

// Botón compacto (punto + nombre) que abre un popover de vidrio con la
// paleta. Para listas de configuración donde cada fila tiene su color.
export function ColorSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string | null | undefined;
  onChange: (key: StatusColorKey) => void;
  disabled?: boolean;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c = STATUS_COLORS[resolveStatusColorKey(value)];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
      >
        <span className={`h-3 w-3 rounded-full ${c.dot}`} />
        {c.label}
      </button>
      {open && (
        <div className="glass animate-pop-in absolute right-0 top-10 z-40 w-[13.5rem] rounded-2xl p-3" role="dialog" aria-label="Elegir color">
          <ColorSwatches
            name={`color-${id}`}
            value={value}
            onChange={(k) => {
              onChange(k);
              setOpen(false);
            }}
          />
          <p className="mt-2 text-[11px] text-slate-500">{c.hint}</p>
        </div>
      )}
    </div>
  );
}
