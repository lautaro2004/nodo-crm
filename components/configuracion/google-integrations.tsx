"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge, Button } from "@/components/ui/primitives";

type Feature = "gmail" | "calendar";

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  status: "active" | "revoked" | null;
  googleEmail: string | null;
  features: Record<Feature, boolean>;
}

const RESULT_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Listo, la conexión con Google quedó actualizada." },
  cancelled: { ok: false, text: "No se otorgó el permiso, así que no se conectó nada." },
  account_mismatch: { ok: false, text: "Usá la misma cuenta de Google con la que ya te conectaste, o desconectá Google primero." },
  no_refresh_token: { ok: false, text: "Google no entregó el acceso permanente. Probá conectar de nuevo." },
  invalid_state: { ok: false, text: "La solicitud de conexión venció. Probá de nuevo." },
  wrong_user: { ok: false, text: "La sesión cambió durante la conexión. Probá de nuevo." },
  exchange_failed: { ok: false, text: "No pudimos completar la conexión con Google. Probá de nuevo." },
};

const FEATURES: { key: Feature; title: string; permission: string; description: string }[] = [
  {
    key: "gmail",
    title: "Gmail",
    permission: "Enviar emails en tu nombre",
    description: "Los emails que mandes desde Nodo salen desde tu propia cuenta de Gmail. No podemos leer tu bandeja de entrada.",
  },
  {
    key: "calendar",
    title: "Google Calendar",
    permission: "Ver y editar los eventos de tu calendario",
    description: "Ves tus eventos de Google en el calendario de Nodo y podés crear, editar y eliminar los que creás desde acá.",
  },
];

// La conexión es del usuario que inició sesión y se guarda cifrada en el
// servidor: esta pantalla solo ve el estado, nunca tokens. Se autoriza UNA vez
// y cada funcionalidad pide únicamente su permiso (autorización incremental).
export function GoogleIntegrations() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState<Feature | "disconnect" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/integrations/google/status");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (result) {
      setNotice(RESULT_MESSAGES[result] ?? null);
      params.delete("google");
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
    }
  }, [load]);

  async function connect(feature: Feature) {
    setBusy(feature);
    setNotice(null);
    const res = await fetch("/api/integrations/google/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, returnTo: "/dashboard/configuracion/integraciones" }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; alreadyGranted?: boolean };
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setBusy(null);
    if (res.ok) await load();
    else setNotice({ ok: false, text: "No pudimos iniciar la conexión con Google." });
  }

  async function disconnect() {
    setBusy("disconnect");
    setNotice(null);
    const res = await fetch("/api/integrations/google/disconnect", { method: "POST" });
    setBusy(null);
    setNotice(
      res.ok
        ? { ok: true, text: "Google desconectado. Tus datos de Nodo siguen igual; los eventos ya creados en Google no se borran." }
        : { ok: false, text: "No pudimos desconectar Google." }
    );
    await load();
  }

  if (!status) return <p className="text-sm text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {notice && (
        <p className={`rounded-lg border p-3 text-sm ${notice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {notice.text}
        </p>
      )}
      {!status.configured && <p className="text-sm text-slate-500">La conexión con Google todavía no está habilitada en este entorno.</p>}
      {status.status === "revoked" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Google revocó el acceso. Volvé a conectar para seguir usando estas funciones.
        </p>
      )}
      {status.connected && status.googleEmail && (
        <p className="text-sm text-slate-700">
          Cuenta conectada: <strong>{status.googleEmail}</strong>
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {FEATURES.map((f) => {
          const on = status.features[f.key];
          return (
            <li key={f.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
                  <Badge variant={on ? "success" : "neutral"}>{on ? "Conectado" : "No conectado"}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{f.description}</p>
                <p className="mt-1 text-xs text-slate-400">Permiso que se solicita: {f.permission}.</p>
              </div>
              {!on && (
                <Button variant="secondary" disabled={busy !== null || !status.configured} onClick={() => connect(f.key)}>
                  {busy === f.key ? "Redirigiendo…" : f.key === "gmail" ? "Conectar Gmail" : "Conectar Calendar"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {status.connected && (
        <Button variant="ghost" disabled={busy !== null} onClick={disconnect}>
          {busy === "disconnect" ? "Desconectando…" : "Desconectar Google"}
        </Button>
      )}
    </div>
  );
}
