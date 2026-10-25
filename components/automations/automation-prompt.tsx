"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Modal } from "@/components/ui/modal";
import { Button, Input, Label, Select } from "@/components/ui/primitives";
import { FieldInput } from "@/components/custom-fields/field-input";
import { RecordPicker, type PickedRecord } from "@/components/custom-modules/record-picker";

// Validaciones "antes de guardar" de las automatizaciones, del lado del
// navegador. Cuando CUALQUIER request a /api responde 422
// { error: "automation_required" } (ver AutomationRequirementError en
// modules/automations/workflow.ts), este proveedor:
//   1. muestra qué datos exige la regla (ej. "Motivo de rechazo"),
//   2. los agrega al MISMO body JSON en el lugar que indica el servidor
//      (bodyPath: ["statusReason"], ["customValues", "<id>"], ["values", "<id>"]),
//   3. reintenta el request y devuelve esa respuesta al componente que lo
//      hizo, como si nada (el Kanban, un selector de estado, un formulario…).
// Si la regla IMPIDE el cambio, o la persona cancela, el componente recibe
// la respuesta 422 original y muestra su error habitual. La regla se vuelve
// a validar en el servidor con los datos nuevos: esto es solo UX.

interface RequirementField {
  key: string;
  label: string;
  type: string;
  options: { value: string; label: string }[];
  target?: string;
  multiple?: boolean;
  bodyPath: string[];
}

interface Requirement {
  ruleName: string;
  message: string;
  blocked: boolean;
  fields: RequirementField[];
}

type Pending = { requirement: Requirement; resolve: (values: Record<string, string> | null) => void };

let installed = false;

function isApiRequest(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function setPath(target: Record<string, unknown>, path: string[], value: string) {
  let cursor = target;
  for (const key of path.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

export function AutomationPromptProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const askRef = useRef<(r: Requirement) => Promise<Record<string, string> | null>>(() => Promise.resolve(null));
  askRef.current = (requirement) => new Promise((resolve) => setPending({ requirement, resolve }));

  useEffect(() => {
    if (installed) return;
    installed = true;
    const original = window.fetch.bind(window);
    const wrapped = async (input: RequestInfo | URL, init?: RequestInit, attempt = 0): Promise<Response> => {
      const res = await original(input, init);
      if (res.status !== 422 || attempt > 3 || !isApiRequest(input) || typeof init?.body !== "string") return res;
      const data = (await res.clone().json().catch(() => null)) as (Requirement & { error?: string }) | null;
      if (data?.error !== "automation_required") return res;
      const values = await askRef.current(data);
      if (!values) return res;
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(init.body);
      } catch {
        return res;
      }
      for (const f of data.fields) if (values[f.key] !== undefined) setPath(body, f.bodyPath, values[f.key]);
      return wrapped(input, { ...init, body: JSON.stringify(body) }, attempt + 1);
    };
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => wrapped(input, init);
    return () => {
      window.fetch = original;
      installed = false;
    };
  }, []);

  function finish(values: Record<string, string> | null) {
    pending?.resolve(values);
    setPending(null);
  }

  return (
    <>
      {children}
      {pending && <RequirementModal key={pending.requirement.ruleName + pending.requirement.message} requirement={pending.requirement} onDone={finish} />}
    </>
  );
}

function RequirementModal({ requirement, onDone }: { requirement: Requirement; onDone: (values: Record<string, string> | null) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(requirement.fields.map((f) => [f.key, ""])));
  const [picked, setPicked] = useState<Record<string, PickedRecord[]>>({});
  const missing = requirement.fields.some((f) => !values[f.key]?.trim());

  if (requirement.blocked) {
    return (
      <Modal open onClose={() => onDone(null)} title="No se puede guardar este cambio" description={`Regla “${requirement.ruleName}”`}>
        <p className="text-sm text-slate-700">{requirement.message}</p>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => onDone(null)}>
            Entendido
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={() => onDone(null)} title="Faltan datos para guardar" description={`Regla “${requirement.ruleName}”`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!missing) onDone(values);
        }}
      >
        <p className="text-sm text-slate-700">{requirement.message}</p>
        {requirement.fields.map((f) => {
          const id = `req-${f.key}`;
          const set = (v: string) => setValues((p) => ({ ...p, [f.key]: v }));
          let control: ReactNode;
          if (f.type === "relation" && f.target) {
            control = (
              <RecordPicker
                id={id}
                targetEntity={f.target}
                multiple={!!f.multiple}
                value={picked[f.key] ?? []}
                onChange={(next) => {
                  setPicked((p) => ({ ...p, [f.key]: next }));
                  set(next.map((r) => r.id).join(","));
                }}
              />
            );
          } else if (f.type === "user" || (f.type === "select" && f.options.length > 0 && f.options.some((o) => o.value !== o.label))) {
            control = (
              <Select id={id} value={values[f.key]} onChange={(e) => set(e.target.value)}>
                <option value="">Elegí una opción…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            );
          } else if (["text", "email", "phone", "url"].includes(f.type)) {
            control = <Input id={id} autoFocus value={values[f.key]} onChange={(e) => set(e.target.value)} maxLength={500} />;
          } else {
            control = <FieldInput id={id} label={f.label} type={f.type} options={f.options.map((o) => o.value)} value={values[f.key]} onChange={set} />;
          }
          return (
            <div key={f.key}>
              <Label htmlFor={id}>{f.label} (obligatorio)</Label>
              {control}
            </div>
          );
        })}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onDone(null)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={missing}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
