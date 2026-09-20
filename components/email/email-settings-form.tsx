"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Input, Label, Select } from "@/components/ui/primitives";

const STATUS_LABEL: Record<string, { label: string; variant: "neutral" | "brand" | "success" | "warning" | "danger" }> = {
  not_configured: { label: "Sin configurar", variant: "warning" },
  provider_unavailable: { label: "Proveedor no disponible en el servidor", variant: "danger" },
  sandbox: { label: "Modo prueba (no envía)", variant: "brand" },
  ready: { label: "Listo para enviar", variant: "success" },
};

export function EmailSettingsForm({
  initial,
  status: initialStatus,
}: {
  initial: { provider: string; fromEmail: string; fromName: string };
  status: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/email/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      setMessage("Revisá los datos (el email del remitente debe ser válido).");
      return;
    }
    const data = await res.json();
    setStatus(data.status);
    setMessage("Guardado.");
    router.refresh();
  }

  const badge = STATUS_LABEL[status] ?? STATUS_LABEL.not_configured;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Estado:</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div>
        <Label htmlFor="provider">Proveedor</Label>
        <Select id="provider" value={values.provider} onChange={(e) => setValues({ ...values, provider: e.target.value })}>
          <option value="sandbox">Modo prueba (no entrega correos)</option>
          <option value="resend">Resend</option>
        </Select>
        {values.provider === "resend" && (
          <p className="mt-1 text-xs text-slate-500">
            Requiere la variable de entorno RESEND_API_KEY en el servidor y que el dominio del remitente esté verificado en Resend.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fromEmail">Email remitente</Label>
          <Input
            id="fromEmail"
            type="email"
            value={values.fromEmail}
            onChange={(e) => setValues({ ...values, fromEmail: e.target.value })}
            placeholder="ventas@tuempresa.com"
          />
        </div>
        <div>
          <Label htmlFor="fromName">Nombre del remitente</Label>
          <Input id="fromName" value={values.fromName} onChange={(e) => setValues({ ...values, fromName: e.target.value })} placeholder="Tu Empresa" />
        </div>
      </div>

      {message && <p className="text-sm text-slate-600">{message}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
