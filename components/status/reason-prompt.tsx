"use client";

import { useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button, Input, Label, Select } from "@/components/ui/primitives";

// Pide el motivo obligatorio de una transición (ej. "Descartado"). Lo usan
// el selector de estado del detalle y el Kanban. Es solo UX: el servidor
// valida lo mismo (reason_required / invalid_reason) venga de donde venga
// el cambio.
export function useReasonPrompt() {
  const [state, setState] = useState<{ statusLabel: string; options: string[] } | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  function ask(statusLabel: string, options: string[]): Promise<string | null> {
    setValue(options[0] ?? "");
    setState({ statusLabel, options });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }

  function finish(v: string | null) {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  }

  const element = (
    <Modal open={!!state} onClose={() => finish(null)} title={state ? `Pasar a “${state.statusLabel}”` : undefined}>
      {state && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) finish(value.trim());
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="status-reason">Motivo (obligatorio)</Label>
            {state.options.length > 0 ? (
              <Select id="status-reason" value={value} onChange={(e) => setValue(e.target.value)}>
                {state.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="status-reason" autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} placeholder="Ej: No tiene presupuesto este año" />
            )}
            <p className="mt-1.5 text-xs text-slate-500">Queda en el historial y alimenta el informe de motivos de rechazo.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => finish(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Confirmar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );

  return { ask, element };
}
