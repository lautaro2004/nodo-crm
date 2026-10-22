"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { XIcon } from "@/components/ui/icons";

// Toasts discretos para confirmar operaciones (o avisar fallas que no
// tienen un lugar natural en la pantalla). Sin librerías:
// - abajo a la derecha (abajo al centro en móvil), máximo 3 a la vez;
// - `role="status"` + aria-live polite (los de error: assertive);
// - se cierran solos (5 s; 6 s los de error), se pausan con el mouse encima.
// Los errores de formularios siguen mostrándose junto al formulario: el
// toast es complemento, no reemplazo.

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface ToastApi {
  show: (t: { tone?: Tone; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Fuera del provider (ej. tests o pantallas sin layout) no rompe: no-op.
const NOOP: ToastApi = { show: () => {}, success: () => {}, error: () => {}, info: () => {} };

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const api = useMemo<ToastApi>(() => {
    const show: ToastApi["show"] = ({ tone = "success", title, description }) =>
      setItems((list) => [...list.slice(-2), { id: nextId++, tone, title, description }]);
    return {
      show,
      success: (title, description) => show({ tone: "success", title, description }),
      error: (title, description) => show({ tone: "error", title, description }),
      info: (title, description) => show({ tone: "info", title, description }),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {items.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE = {
  success: { dot: "bg-emerald-500", ring: "ring-emerald-500/15" },
  error: { dot: "bg-red-500", ring: "ring-red-500/15" },
  info: { dot: "bg-brand-500", ring: "ring-brand-500/15" },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.tone === "error" ? 6000 : 5000);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, onDismiss]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[var(--shadow-lift)] ring-4 ${TONE[item.tone].ring} supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-xl`}
    >
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[item.tone].dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="-mr-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
