"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/primitives";

// Confirmación con el estilo de Nodo en lugar de window.confirm() (cuadro
// nativo del navegador, sin estilo, que en algunos navegadores móviles se
// bloquea o se muestra con el dominio como título).
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "¿Borrar la etapa?", tone: "danger" }))) return;
//
// Devuelve una promesa que resuelve true/false. Fuera del provider cae al
// window.confirm nativo para no romper nunca una acción.

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return ctx ?? (async (o) => window.confirm(typeof o === "string" ? o : [o.title, o.description].filter(Boolean).join("\n\n")));
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    // Si había otra confirmación abierta, se resuelve como cancelada.
    resolver.current?.(false);
    setOptions(typeof o === "string" ? { title: o } : o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function finish(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }

  const danger = options?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!options} onClose={() => finish(false)} title={options?.title} description={options?.description} maxWidth="max-w-sm">
        <div className="flex justify-end gap-2 pt-2">
          {/* En acciones destructivas el foco arranca en "Cancelar". */}
          <Button type="button" variant="secondary" onClick={() => finish(false)} data-autofocus={danger || undefined}>
            {options?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} onClick={() => finish(true)} data-autofocus={!danger || undefined}>
            {options?.confirmLabel ?? (danger ? "Borrar" : "Confirmar")}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
