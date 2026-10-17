"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/primitives";
import { readApiError } from "@/lib/error-messages";
import { resolveStatusColor } from "@/lib/status-colors";
import { useReasonPrompt } from "@/components/status/reason-prompt";

// Select de estado/etapa que persiste al cambiar (PATCH a `apiPath`).
// - Muestra el color configurado del valor actual (punto a la izquierda).
// - Optimista con reversión: si el servidor rechaza (transición inválida,
//   sin permisos, red), vuelve al valor anterior y muestra el motivo.
// - `field` permite reusarlo para `stageId` (etapa de oportunidad).
export function StatusSelect({
  apiPath,
  value,
  options,
  field = "status",
  label,
}: {
  apiPath: string;
  value: string;
  options: { key: string; label: string; color?: string | null; requiresReason?: boolean; reasonOptions?: string[] }[];
  field?: string;
  label?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const reason = useReasonPrompt();

  useEffect(() => setCurrent(value), [value]);

  const hasColors = options.some((o) => o.color !== undefined);
  const selected = options.find((o) => o.key === current);

  async function handleChange(next: string) {
    const previous = current;
    const target = options.find((o) => o.key === next);
    let statusReason: string | null = null;
    if (target?.requiresReason) {
      statusReason = await reason.ask(target.label, target.reasonOptions ?? []);
      if (!statusReason) return; // canceló: no se cambia nada
    }
    setCurrent(next);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next, ...(statusReason ? { statusReason } : {}) }),
      });
      if (!res.ok) {
        setCurrent(previous);
        setError(await readApiError(res));
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setCurrent(previous);
      setError("Sin conexión. El cambio no se guardó.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="relative">
        {hasColors && (
          <span
            aria-hidden
            className={`pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${resolveStatusColor(selected?.color).dot}`}
          />
        )}
        <Select
          aria-label={label}
          value={current}
          disabled={saving}
          onChange={(e) => handleChange(e.target.value)}
          className={`w-auto min-w-40 ${hasColors ? "pl-7" : ""}`}
        >
          {!selected && <option value={current}>{current}</option>}
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p role="alert" className="mt-1 max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
      {reason.element}
    </div>
  );
}
