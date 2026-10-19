"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { Spinner } from "@/components/ui/primitives";

// Select propio de Nodo (listbox ARIA, sin librerías).
//
// Cuándo usarlo: selectores "de acción" que cambian algo al instante y se
// ven en barras o detalles (estado, responsable, filtros). Ahí el desplegable
// nativo rompía la estética y no podía mostrar el color del estado.
// Cuándo NO: campos de formularios largos — el <Select> nativo de
// primitives (ya estilizado) sigue siendo la mejor opción en móviles.
//
// Teclado: Enter/Espacio/↓/↑ abren; ↑/↓, Inicio/Fin y escribir letras
// navegan; Enter elige; Escape o Tab cierran. Con más de 8 opciones (o
// `searchable`) aparece un buscador.

export interface SelectMenuOption {
  value: string;
  label: string;
  /** Texto secundario (ej. email). */
  hint?: string;
  /** Elemento a la izquierda (ej. punto de color del estado). */
  leading?: ReactNode;
  disabled?: boolean;
}

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Elegí una opción",
  ariaLabel,
  id,
  disabled = false,
  loading = false,
  searchable,
  className = "min-w-40",
  align = "left",
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  /** Guardando el cambio: spinner en el disparador y sin interacción. */
  loading?: boolean;
  searchable?: boolean;
  className?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
}) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [placeAbove, setPlaceAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const withSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function openMenu() {
    if (disabled || loading) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    // Si no entra abajo (≈ 280 px) y hay más lugar arriba, se abre hacia arriba.
    setPlaceAbove(!!rect && window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom);
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function choose(option: SelectMenuOption | undefined) {
    if (!option || option.disabled) return;
    close();
    if (option.value !== value) onChange(option.value);
  }

  // Click afuera.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Foco al abrir (buscador o lista) y opción activa visible.
  useEffect(() => {
    if (!open) return;
    if (withSearch) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, withSearch]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function move(delta: number) {
    if (visible.length === 0) return;
    let i = active;
    for (let n = 0; n < visible.length; n++) {
      i = (i + delta + visible.length) % visible.length;
      if (!visible[i].disabled) break;
    }
    setActive(i);
  }

  function onListKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(visible.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        choose(visible[active]);
        break;
      case " ":
        if (!withSearch) {
          e.preventDefault();
          choose(visible[active]);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Typeahead (solo sin buscador: con buscador las letras filtran).
        if (!withSearch && e.key.length === 1 && /\S/.test(e.key)) {
          const now = Date.now();
          const t = typeahead.current;
          t.text = now - t.at > 700 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const idx = visible.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
          if (idx >= 0) setActive(idx);
        }
    }
  }

  const height = size === "sm" ? "h-8 text-xs" : "h-10 text-sm";

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        id={baseId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openMenu();
          }
        }}
        className={`flex w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-slate-900 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color] duration-150 ${height} ${
          open ? "border-brand-500 ring-4 ring-brand-500/15" : "border-slate-200 hover:border-slate-300"
        } focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-busy:cursor-progress`}
      >
        {selected?.leading}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-slate-400"}`}>{selected?.label ?? placeholder}</span>
        {loading ? (
          <Spinner className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ease-[var(--ease-out)] ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5.5 7.5 10 12l4.5-4.5" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className={`menu-surface animate-pop-in absolute z-50 min-w-full max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl p-1 ${align === "right" ? "right-0" : "left-0"} ${
            placeAbove ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5"
          }`}
        >
          {withSearch && (
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onListKey}
              placeholder="Buscar…"
              aria-label="Buscar opción"
              aria-controls={listId}
              aria-activedescendant={visible[active] ? `${baseId}-opt-${active}` : undefined}
              className="mb-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={withSearch ? -1 : 0}
            aria-label={ariaLabel}
            aria-activedescendant={visible[active] ? `${baseId}-opt-${active}` : undefined}
            onKeyDown={withSearch ? undefined : onListKey}
            className="max-h-64 overflow-y-auto overscroll-contain outline-none"
          >
            {visible.length === 0 && <li className="px-2.5 py-2 text-sm text-slate-400">Sin resultados</li>}
            {visible.map((o, i) => {
              const isSelected = o.value === value;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  id={`${baseId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  onMouseMove={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors duration-100 ${
                    o.disabled ? "cursor-not-allowed text-slate-400" : isActive ? "bg-slate-900/[0.06] text-slate-900" : "text-slate-700"
                  }`}
                >
                  {o.leading}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${isSelected ? "font-medium text-slate-900" : ""}`}>{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-slate-500">{o.hint}</span>}
                  </span>
                  {isSelected && (
                    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 10.5 3.2 3L15 7" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
