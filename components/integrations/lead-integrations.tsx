"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, InlineAlert, Input, Label, Skeleton, Spinner } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";
import { readApiError } from "@/lib/error-messages";
import { APPS_SCRIPT_FILE_NAME, APPS_SCRIPT_FUNCTIONS, APPS_SCRIPT_SECRET_PROPERTY, buildAppsScript } from "@/modules/integrations/apps-script";
import { TARGET_LABELS } from "@/modules/integrations/normalize";

// Configuración → Integraciones: captura automática de leads (Instagram y
// Google Sheets). Solo ve estados y configuración; los tokens y secretos
// nunca llegan al navegador (el de Sheets se muestra UNA vez al crearlo o
// regenerarlo, porque lo tiene que pegar el cliente en su script).

export interface IntegrationItem {
  id: string;
  type: "google_sheets" | "instagram";
  name: string;
  status: string;
  externalUsername: string | null;
  config: Record<string, unknown>;
  tokenExpiresAt: string | null;
  scopes: string[];
  lastEventAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  hasSecret: boolean;
  endpoint: string | null;
  createdAt: string;
  stats: { processed: number; failed: number; last24h: number };
}

interface EventItem {
  id: string;
  externalId: string;
  kind: string;
  status: string;
  outcome: string | null;
  error: string | null;
  leadId: string | null;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
}

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Conectada", variant: "success" },
  pending: { label: "Pendiente de configuración", variant: "warning" },
  paused: { label: "Pausada", variant: "neutral" },
  error: { label: "Con errores", variant: "danger" },
  disconnected: { label: "Desconectada", variant: "neutral" },
};

const IG_RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Instagram quedó conectado. Los mensajes nuevos van a llegar a Nodo." },
  connected_no_webhook: { ok: false, text: "La cuenta se conectó, pero Meta no activó la recepción de mensajes. Revisá los permisos de la app y volvé a conectar." },
  denied: { ok: false, text: "No se otorgaron los permisos, así que no se conectó nada." },
  missing_permissions: { ok: false, text: "Falta el permiso para leer mensajes (instagram_business_manage_messages). Volvé a conectar y aceptalo." },
  invalid_state: { ok: false, text: "La solicitud de conexión venció o no corresponde a esta sesión. Probá de nuevo." },
  account_linked_elsewhere: { ok: false, text: "Esa cuenta de Instagram ya está conectada a otro negocio en Nodo." },
  token_exchange_failed: { ok: false, text: "Meta no aceptó la autorización. Probá de nuevo; si persiste, revisá la URL de callback en la app." },
  account_lookup_failed: { ok: false, text: "No pudimos leer los datos de la cuenta de Instagram. Probá de nuevo." },
  not_configured: { ok: false, text: "Falta configurar la app de Instagram en el servidor." },
  forbidden: { ok: false, text: "Solo dueños o administradores pueden conectar Instagram." },
  meta_error: { ok: false, text: "Meta devolvió un error durante la conexión. Probá de nuevo." },
  missing_code: { ok: false, text: "La respuesta de Meta llegó incompleta. Probá de nuevo." },
  no_workspace: { ok: false, text: "No encontramos tu espacio de trabajo." },
};

const OUTCOME_LABELS: Record<string, string> = {
  created: "Lead creado",
  updated: "Lead existente actualizado",
  matched_contact: "Registrado en un contacto existente",
  activity: "Registrado en el historial",
  create_disabled: "Sin lead (creación desactivada)",
  no_lead: "Respuesta sin lead asociado",
  replies_off: "Respuesta no registrada",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function LeadIntegrations({
  initial,
  environment,
  customFields,
}: {
  initial: IntegrationItem[];
  environment: { encryption: boolean; instagram: boolean };
  customFields: { id: string; label: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setItems(initial), [initial]);

  // Resultado del OAuth de Instagram (?instagram=…).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("instagram");
    if (!result) return;
    const message = IG_RESULTS[result] ?? { ok: false, text: "No se pudo completar la conexión con Instagram." };
    if (message.ok) toast.success(message.text);
    else setNotice(message);
    params.delete("instagram");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [toast]);

  const refresh = useCallback(() => router.refresh(), [router]);
  const instagram = items.find((i) => i.type === "instagram") ?? null;
  const sheets = items.filter((i) => i.type === "google_sheets");

  return (
    <div className="space-y-6">
      {!environment.encryption && (
        <InlineAlert>
          Falta la clave de cifrado de integraciones en el servidor (<code>INTEGRATIONS_ENCRYPTION_KEY</code>). Sin ella no se pueden guardar tokens ni
          secretos de forma segura.
        </InlineAlert>
      )}
      {notice && !notice.ok && <InlineAlert onDismiss={() => setNotice(null)}>{notice.text}</InlineAlert>}
      <InstagramCard integration={instagram} configured={environment.instagram && environment.encryption} onChanged={refresh} />
      <SheetsSection items={sheets} enabled={environment.encryption} customFields={customFields} onChanged={refresh} />
    </div>
  );
}

// ─── Instagram ──────────────────────────────────────────────────────────

function InstagramCard({ integration, configured, onChanged }: { integration: IntegrationItem | null; configured: boolean; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connected = !!integration && integration.status !== "disconnected" && integration.hasSecret;
  const config = (integration?.config ?? {}) as { createLeadOnFirstMessage?: boolean; logReplies?: boolean; webhookSubscribed?: boolean; missingScopes?: string[] };

  async function connect() {
    setBusy("connect");
    setError(null);
    const res = await apiFetch("/api/integrations/instagram/connect", { method: "POST" });
    if (!res.ok) {
      setBusy(null);
      const body = await res.json().catch(() => ({}));
      return setError(body.error === "instagram_not_configured" ? "Falta configurar la app de Instagram en el servidor." : await readApiError(res));
    }
    const { url } = await res.json();
    // Se mantiene el estado de carga: el navegador se va a Instagram.
    window.location.assign(url);
  }

  async function patch(key: string, body: Record<string, unknown>, success: string) {
    if (!integration) return;
    setBusy(key);
    setError(null);
    const res = await apiFetch(`/api/integrations/lead-sources/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) return setError(await readApiError(res));
    toast.success(success);
    onChanged();
  }

  async function disconnect() {
    if (!integration) return;
    const ok = await confirm({
      title: "¿Desconectar Instagram?",
      description: "Nodo deja de recibir mensajes y se borra el acceso guardado. Los leads y el historial ya creados se conservan.",
      tone: "danger",
      confirmLabel: "Desconectar",
    });
    if (!ok) return;
    setBusy("disconnect");
    const res = await apiFetch(`/api/integrations/lead-sources/${integration.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return setError(await readApiError(res));
    toast.success("Instagram desconectado");
    onChanged();
  }

  const expires = integration?.tokenExpiresAt ? new Date(integration.tokenExpiresAt) : null;
  const expiresSoon = expires && expires.getTime() - Date.now() < 7 * 24 * 3600 * 1000;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-600 text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Instagram</h2>
            <p className="mt-0.5 max-w-lg text-sm text-slate-500">
              Los mensajes directos que recibe tu cuenta profesional entran como leads. Una persona = un lead; los mensajes siguientes quedan en su historial.
            </p>
          </div>
        </div>
        <StatusBadge status={connected ? integration!.status : "disconnected"} />
      </div>

      {error && (
        <div className="mt-4">
          <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>
        </div>
      )}

      {!connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={connect} loading={busy === "connect"} disabled={!configured}>
            {busy === "connect" ? "Abriendo Instagram…" : "Conectar con Instagram"}
          </Button>
          <p className="text-xs text-slate-500">
            {configured
              ? "Vas a iniciar sesión en Instagram y aceptar los permisos de lectura de mensajes. Requiere una cuenta profesional (empresa o creador)."
              : "La conexión todavía no está habilitada en este servidor."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Info label="Cuenta" value={integration!.externalUsername ? `@${integration!.externalUsername}` : "—"} />
            <Info label="Recepción de mensajes" value={config.webhookSubscribed ? "Activa" : "Sin activar"} tone={config.webhookSubscribed ? undefined : "danger"} />
            <Info label="Último mensaje" value={timeAgo(integration!.lastEventAt)} />
            <Info
              label="Acceso vence"
              value={expires ? expires.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "—"}
              hint={expiresSoon ? "Se renueva automáticamente" : undefined}
            />
          </dl>
          {integration!.lastError && integration!.status === "error" && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{integration!.lastError}</p>}
          <div className="flex flex-col gap-2 text-sm text-slate-700">
            <Toggle
              checked={config.createLeadOnFirstMessage !== false}
              disabled={!!busy}
              busy={busy === "create"}
              onChange={(v) => patch("create", { config: { createLeadOnFirstMessage: v } }, v ? "Se crearán leads nuevos" : "No se crearán leads nuevos")}
              label="Crear un lead cuando escribe alguien que no está en Nodo"
            />
            <Toggle
              checked={config.logReplies !== false}
              disabled={!!busy}
              busy={busy === "replies"}
              onChange={(v) => patch("replies", { config: { logReplies: v } }, "Preferencia guardada")}
              label="Registrar en el historial las respuestas enviadas desde la cuenta"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {integration!.status === "paused" ? (
              <Button size="sm" variant="secondary" loading={busy === "status"} disabled={!!busy} onClick={() => patch("status", { status: "active" }, "Instagram reactivado")}>
                Reactivar
              </Button>
            ) : (
              <Button size="sm" variant="secondary" loading={busy === "status"} disabled={!!busy} onClick={() => patch("status", { status: "paused" }, "Instagram en pausa")}>
                Pausar
              </Button>
            )}
            <Button size="sm" variant="secondary" loading={busy === "connect"} disabled={!!busy || !configured} onClick={connect}>
              Volver a conectar
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" loading={busy === "disconnect"} disabled={!!busy} onClick={disconnect}>
              Desconectar
            </Button>
          </div>
        </div>
      )}
      {integration && integration.status !== "disconnected" && <EventsPanel integration={integration} />}
    </Card>
  );
}

function Info({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-medium ${tone === "danger" ? "text-red-700" : "text-slate-900"}`}>{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled, busy }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; busy?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-60 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-4"
      />
      <span>{label}</span>
      {busy && <Spinner className="h-3.5 w-3.5 text-slate-400" />}
    </label>
  );
}

// ─── Eventos recientes (compartido) ─────────────────────────────────────

function EventsPanel({ integration }: { integration: IntegrationItem }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch(`/api/integrations/lead-sources/${integration.id}/events`);
    setLoading(false);
    if (!res.ok) return setError(await readApiError(res));
    setEvents((await res.json()).events);
  }, [integration.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function retry(ev: EventItem) {
    setRetrying(ev.id);
    const res = await apiFetch(`/api/integrations/events/${ev.id}/retry`, { method: "POST" });
    setRetrying(null);
    if (!res.ok) return toast.error("No se pudo reintentar", await readApiError(res));
    const body = await res.json();
    if (body.status === "failed") toast.error("Volvió a fallar", body.error ?? undefined);
    else toast.success("Evento procesado");
    void load();
  }

  const { stats } = integration;
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left text-sm text-slate-600 hover:text-slate-900"
      >
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <strong className="font-semibold text-slate-900">{stats.processed}</strong> procesados
          </span>
          <span className={stats.failed ? "text-red-700" : undefined}>
            <strong className="font-semibold">{stats.failed}</strong> con error
          </span>
          <span>{stats.last24h} en las últimas 24 h</span>
          <span className="text-slate-400">Último éxito: {timeAgo(integration.lastSuccessAt)}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-brand-700">{open ? "Ocultar actividad" : "Ver actividad"}</span>
      </button>
      {open && (
        <div className="mt-3 animate-fade-in">
          {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
          {events === null ? (
            <div className="space-y-2" aria-label="Cargando actividad">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : events.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Todavía no llegó nada.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100" aria-busy={loading || undefined}>
              {events.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-xs text-slate-400">{timeAgo(ev.receivedAt)}</span>
                  <EventStatus status={ev.status} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {ev.kind === "echo" ? "Respuesta enviada · " : ""}
                    {ev.error ?? (ev.outcome ? (OUTCOME_LABELS[ev.outcome] ?? ev.outcome) : "")}
                    {ev.attempts > 1 && <span className="text-slate-400"> · {ev.attempts} intentos</span>}
                  </span>
                  {ev.leadId && (
                    <Link href={`/dashboard/leads/${ev.leadId}`} className="text-xs font-medium text-brand-700 hover:underline">
                      Ver lead
                    </Link>
                  )}
                  {ev.status === "failed" && (
                    <Button size="sm" variant="secondary" loading={retrying === ev.id} disabled={!!retrying} onClick={() => retry(ev)}>
                      Reintentar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => void load()} loading={loading}>
              Actualizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventStatus({ status }: { status: string }) {
  if (status === "processed") return <Badge variant="success">Procesado</Badge>;
  if (status === "failed") return <Badge variant="danger">Error</Badge>;
  if (status === "skipped") return <Badge>Omitido</Badge>;
  return (
    <Badge variant="brand">
      <Spinner className="h-3 w-3" /> Procesando
    </Badge>
  );
}

// ─── Google Sheets ──────────────────────────────────────────────────────

function SheetsSection({
  items,
  enabled,
  customFields,
  onChanged,
}: {
  items: IntegrationItem[];
  enabled: boolean;
  customFields: { id: string; label: string }[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ name: string; secret: string | null; endpoint: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value || creating) return;
    setCreating(true);
    setError(null);
    const res = await apiFetch("/api/integrations/lead-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "google_sheets", name: value }),
    });
    setCreating(false);
    if (!res.ok) return setError(await readApiError(res));
    const body = await res.json();
    setName("");
    setReveal({ name: value, secret: body.secret, endpoint: body.endpoint });
    onChanged();
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M4 9h16M4 15h16M10 9v12" />
          </svg>
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Google Sheets</h2>
          <p className="mt-0.5 max-w-lg text-sm text-slate-500">
            Cada fila nueva de una planilla (por ejemplo, las respuestas de un formulario) entra como lead. La planilla puede ser privada: un script dentro de ella
            envía las filas firmadas a Nodo.
          </p>
          <p className="mt-1 max-w-lg text-xs text-slate-500">
            Al crear la conexión te mostramos paso a paso dónde pegar el código en Apps Script. No reemplaza ni interfiere con otros scripts que ya tenga la
            planilla.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <SheetsItem key={item.id} item={item} customFields={customFields} onChanged={onChanged} onReveal={setReveal} />
        ))}
      </div>

      <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Label htmlFor="sheets-name">Nueva conexión</Label>
          <Input id="sheets-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej: Formulario de la web" disabled={!enabled} />
        </div>
        <Button type="submit" loading={creating} disabled={!enabled || !name.trim()}>
          {creating ? "Creando…" : "Crear conexión"}
        </Button>
      </form>

      <SecretModal reveal={reveal} onClose={() => setReveal(null)} />
    </Card>
  );
}

function SecretModal({ reveal, onClose }: { reveal: { name: string; secret: string | null; endpoint: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [showCode, setShowCode] = useState(false);
  const script = useMemo(() => (reveal ? buildAppsScript({ endpoint: reveal.endpoint, integrationName: reveal.name }) : ""), [reveal]);
  const F = APPS_SCRIPT_FUNCTIONS;
  const formSnippet = `// después de escribir la fila (ej. hoja.appendRow(...)):\n${F.sendRow}(hoja, hoja.getLastRow());`;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copiado`);
    } catch {
      toast.error("No se pudo copiar", "Seleccioná el texto y copialo a mano.");
    }
  }

  return (
    <Modal
      open={!!reveal}
      onClose={onClose}
      title="Conectá tu planilla de Google"
      description={
        reveal?.secret
          ? "Seguí estos pasos en tu planilla. Guardá el secreto ahora: por seguridad, Nodo no lo vuelve a mostrar."
          : "Seguí estos pasos en tu planilla. El secreto no se vuelve a mostrar: si lo perdiste, usá «Regenerar secreto»."
      }
      maxWidth="max-w-2xl"
    >
      {reveal && (
        <div className="space-y-4 text-sm">
          <ol className="space-y-3">
            <Step n={1} title="Abrí el editor de Apps Script">
              En tu planilla de Google, andá al menú <strong>Extensiones → Apps Script</strong>. Se abre el editor en otra pestaña.
            </Step>
            <Step n={2} title="Creá un archivo nuevo (no borres lo que ya tengas)">
              En el panel de la izquierda, junto a <strong>Archivos</strong>, tocá <strong>+ → Secuencia de comandos</strong> y llamalo{" "}
              <Code>{APPS_SCRIPT_FILE_NAME}</Code>. Si la planilla ya tiene código (por ejemplo, el de tu formulario), dejalo como está: el código de Nodo
              usa nombres propios (<Code>NodoCRM</Code> y funciones <Code>nodoCRM_…</Code>) y no interfiere con él.
            </Step>
            <Step n={3} title="Pegá el código de Nodo y guardá">
              <p>
                En el archivo nuevo borrá el ejemplo (<Code>function myFunction()…</Code>), pegá el código y guardá con <strong>Ctrl + S</strong> (o el ícono
                del disquete).
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => copy(script, "Código")}>
                  Copiar código
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowCode((v) => !v)} aria-expanded={showCode}>
                  {showCode ? "Ocultar código" : "Ver código"}
                </Button>
              </div>
              {showCode && (
                <textarea
                  aria-label="Código para Apps Script"
                  id="sheets-script"
                  readOnly
                  value={script}
                  rows={10}
                  className="mt-2 w-full animate-fade-in rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] text-slate-700"
                />
              )}
            </Step>
            <Step n={4} title="Guardá el secreto en las propiedades del script">
              <p>
                En el editor: <strong>⚙ Configuración del proyecto → Propiedades del script → Agregar propiedad del script</strong>. Así el secreto no queda
                escrito en el código ni en la hoja.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                <span className="text-xs text-slate-500">Propiedad</span>
                <div className="flex gap-2">
                  <Input readOnly value={APPS_SCRIPT_SECRET_PROPERTY} aria-label="Nombre de la propiedad" className="h-8 py-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" size="sm" variant="secondary" onClick={() => copy(APPS_SCRIPT_SECRET_PROPERTY, "Nombre")}>
                    Copiar
                  </Button>
                </div>
                <span className="text-xs text-slate-500">Valor</span>
                {reveal.secret ? (
                  <div className="flex gap-2">
                    <Input id="sheets-secret" readOnly value={reveal.secret} aria-label="Secreto" className="h-8 py-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button type="button" size="sm" variant="secondary" onClick={() => copy(reveal.secret!, "Secreto")}>
                      Copiar
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600">El secreto que guardaste al crear la conexión.</span>
                )}
              </div>
            </Step>
            <Step n={5} title="Probá la conexión">
              Arriba del editor elegí la función <Code>{F.test}</Code> y tocá <strong>Ejecutar</strong>. La primera vez Google pide permisos:{" "}
              <strong>Revisar permisos</strong> → tu cuenta → <strong>Configuración avanzada → Ir a … → Permitir</strong>. Es tu propio script: Nodo no
              recibe acceso a tu cuenta de Google. Al volver a esta pantalla vas a ver las columnas detectadas.
            </Step>
            <Step n={6} title="Mapeá las columnas y activá la integración">
              Acá en Nodo: <strong>Mapeo de columnas</strong> → elegí a qué campo va cada columna → <strong>Guardar mapeo</strong> → <strong>Activar</strong>.
            </Step>
            <Step n={7} title="Activá el envío automático">
              De vuelta en el editor, ejecutá <Code>{F.install}</Code>. Desde ahí, cada fila nueva se envía sola (al cambiar la hoja y, como respaldo, cada 5
              minutos).
            </Step>
          </ol>

          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              <strong className="text-slate-800">Columnas de control:</strong> Nodo agrega al final de la hoja «Nodo ID» y «Nodo estado». No las borres: evitan
              envíos duplicados y muestran si cada fila entró bien.
            </p>
            <p>
              <strong className="text-slate-800">Si tu formulario ya guarda las respuestas con un script:</strong> agregá esta línea justo después de escribir la
              fila, así se envía al instante.
            </p>
            <div className="flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white p-2 font-mono text-[11px] text-slate-700">{formSnippet}</pre>
              <Button type="button" size="sm" variant="secondary" onClick={() => copy(formSnippet, "Línea")}>
                Copiar
              </Button>
            </div>
            <p>
              <strong className="text-slate-800">Filas con error:</strong> se marcan en «Nodo estado». Corregilas y borrá esa celda, o ejecutá{" "}
              <Code>{F.retry}</Code>.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              {reveal.secret ? "Listo, ya lo guardé" : "Cerrar"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{title}</p>
        <div className="mt-0.5 text-slate-600">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-800">{children}</code>;
}

function SheetsItem({
  item,
  customFields,
  onChanged,
  onReveal,
}: {
  item: IntegrationItem;
  customFields: { id: string; label: string }[];
  onChanged: () => void;
  onReveal: (r: { name: string; secret: string | null; endpoint: string }) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const config = item.config as { headers?: string[]; mapping?: Record<string, string>; required?: string[]; spreadsheetName?: string | null; sheetName?: string | null; lastTestAt?: string | null };
  const mappedCount = Object.values(config.mapping ?? {}).filter((t) => t !== "ignore").length;

  async function call(key: string, url: string, init: RequestInit, success?: string) {
    setBusy(key);
    setError(null);
    const res = await apiFetch(url, init);
    setBusy(null);
    if (!res.ok) {
      setError(await readApiError(res));
      return null;
    }
    if (success) toast.success(success);
    return res.json().catch(() => ({}));
  }

  async function setStatus(status: "active" | "paused") {
    const ok = await call(
      "status",
      `/api/integrations/lead-sources/${item.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) },
      status === "active" ? "Integración activada" : "Integración en pausa"
    );
    if (ok) onChanged();
  }

  async function rotate() {
    const ok = await confirm({
      title: "¿Generar un secreto nuevo?",
      description: `El secreto actual deja de funcionar en el acto: vas a tener que actualizar ${APPS_SCRIPT_SECRET_PROPERTY} en las propiedades del script.`,
      confirmLabel: "Generar",
    });
    if (!ok) return;
    const body = await call("rotate", `/api/integrations/lead-sources/${item.id}/secret`, { method: "POST" });
    if (body?.secret) onReveal({ name: item.name, secret: body.secret, endpoint: item.endpoint ?? "" });
  }

  async function remove() {
    const ok = await confirm({
      title: `¿Eliminar la conexión “${item.name}”?`,
      description: "La planilla deja de enviar filas y se borra su historial de envíos. Los leads ya creados se conservan.",
      tone: "danger",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const body = await call("delete", `/api/integrations/lead-sources/${item.id}`, { method: "DELETE" }, "Conexión eliminada");
    if (body) onChanged();
  }

  const script = () => onReveal({ name: item.name, secret: null, endpoint: item.endpoint ?? "" });

  return (
    <div className="rounded-2xl border border-slate-200/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="truncate text-xs text-slate-500">
            {config.spreadsheetName ? `${config.spreadsheetName}${config.sheetName ? ` · ${config.sheetName}` : ""}` : "Planilla sin probar todavía"}
            {config.lastTestAt && ` · probada ${timeAgo(config.lastTestAt)}`}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {error && (
        <div className="mt-3">
          <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>
        </div>
      )}
      {item.status === "pending" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {!config.lastTestAt
            ? `Seguí los pasos de «Cómo conectar» y ejecutá ${APPS_SCRIPT_FUNCTIONS.test} en la planilla para detectar las columnas.`
            : mappedCount === 0
              ? "Conexión probada. Configurá el mapeo de columnas y activá la integración."
              : "Mapeo listo. Activá la integración para empezar a recibir filas."}
        </p>
      )}
      {item.lastError && item.lastErrorAt && <p className="mt-3 text-xs text-red-700">Último error ({timeAgo(item.lastErrorAt)}): {item.lastError}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? "Cerrar mapeo" : `Mapeo de columnas${mappedCount ? ` (${mappedCount})` : ""}`}
        </Button>
        {item.status === "active" ? (
          <Button size="sm" variant="secondary" loading={busy === "status"} disabled={!!busy} onClick={() => setStatus("paused")}>
            Pausar
          </Button>
        ) : (
          <Button size="sm" loading={busy === "status"} disabled={!!busy || mappedCount === 0} onClick={() => setStatus("active")}>
            Activar
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={script}>
          Cómo conectar
        </Button>
        <Button size="sm" variant="ghost" loading={busy === "rotate"} disabled={!!busy} onClick={rotate}>
          Regenerar secreto
        </Button>
        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" loading={busy === "delete"} disabled={!!busy} onClick={remove}>
          Eliminar
        </Button>
      </div>

      {editing && <MappingEditor item={item} customFields={customFields} onSaved={onChanged} />}
      <EventsPanel integration={item} />
    </div>
  );
}

function MappingEditor({ item, customFields, onSaved }: { item: IntegrationItem; customFields: { id: string; label: string }[]; onSaved: () => void }) {
  const toast = useToast();
  const config = item.config as { headers?: string[]; mapping?: Record<string, string>; required?: string[] };
  const [headers, setHeaders] = useState<string[]>(() => Array.from(new Set([...(config.headers ?? []), ...Object.keys(config.mapping ?? {})])));
  const [mapping, setMapping] = useState<Record<string, string>>(() => ({ ...(config.mapping ?? {}) }));
  const [required, setRequired] = useState<string[]>(() => config.required ?? ["name"]);
  const [newHeader, setNewHeader] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; errors?: string[]; data?: Record<string, unknown> } | null>(null);

  const options = useMemo(
    () => [
      { value: "ignore", label: "No importar" },
      ...(["name", "email", "phone", "note"] as const).map((k) => ({ value: k, label: TARGET_LABELS[k] })),
      ...customFields.map((f) => ({ value: `cf:${f.id}`, label: f.label, hint: "Campo personalizado" })),
    ],
    [customFields]
  );
  const hasSample = Object.values(sample).some((v) => v.trim());
  const usedTargets = Array.from(new Set(Object.values(mapping).filter((t) => t && t !== "ignore")));
  const labelOf = (t: string) => options.find((o) => o.value === t)?.label ?? t;

  // Sugerencia automática por nombre de columna (solo si no hay mapeo).
  function guess(header: string): string {
    const h = header.toLowerCase();
    if (/mail/.test(h)) return "email";
    if (/(tel|cel|whats|phone|móvil|movil)/.test(h)) return "phone";
    if (/(nombre|name|apellido)/.test(h)) return "name";
    if (/(mensaje|consulta|comentario|message)/.test(h)) return "note";
    const cf = customFields.find((f) => f.label.toLowerCase() === h);
    return cf ? `cf:${cf.id}` : "ignore";
  }

  function addHeader(e: React.FormEvent) {
    e.preventDefault();
    const h = newHeader.trim();
    if (!h || headers.includes(h)) return;
    setHeaders([...headers, h]);
    setMapping({ ...mapping, [h]: guess(h) });
    setNewHeader("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const cleanRequired = required.filter((r) => usedTargets.includes(r));
    const res = await apiFetch(`/api/integrations/lead-sources/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { mapping, required: cleanRequired } }),
    });
    setSaving(false);
    if (!res.ok) return setError(await readApiError(res));
    toast.success("Mapeo guardado");
    onSaved();
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await apiFetch(`/api/integrations/lead-sources/${item.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: sample, config: { mapping, required: required.filter((r) => usedTargets.includes(r)) } }),
    });
    setTesting(false);
    if (!res.ok) return setError(await readApiError(res));
    setTestResult(await res.json());
  }

  return (
    <div className="mt-4 animate-fade-in space-y-4 rounded-xl bg-slate-50 p-4">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
      {headers.length === 0 ? (
        <p className="text-sm text-slate-600">
          Todavía no conocemos las columnas. Ejecutá <code className="rounded bg-white px-1">{APPS_SCRIPT_FUNCTIONS.test}</code> en el editor de Apps Script, o
          agregalas a mano.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[1fr_14rem_10rem]">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Columna</span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Campo en Nodo</span>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-slate-500 sm:block">Ejemplo</span>
            {headers.map((h) => (
              <div key={h} className="contents">
                <span className="truncate text-sm text-slate-800" title={h}>
                  {h}
                </span>
                <SelectMenu
                  ariaLabel={`Destino de la columna ${h}`}
                  value={mapping[h] ?? "ignore"}
                  onChange={(v) => setMapping({ ...mapping, [h]: v })}
                  options={options}
                  className="w-56 max-w-[60vw]"
                  size="sm"
                />
                <Input
                  aria-label={`Valor de ejemplo para ${h}`}
                  value={sample[h] ?? ""}
                  onChange={(e) => setSample({ ...sample, [h]: e.target.value })}
                  className="col-span-2 h-8 py-1 text-xs sm:col-span-1"
                  placeholder="Opcional"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={addHeader} className="flex gap-2">
        <Input value={newHeader} onChange={(e) => setNewHeader(e.target.value)} placeholder="Agregar columna a mano (igual que en la hoja)" className="h-8 py-1 text-xs" aria-label="Nombre de columna" />
        <Button type="submit" size="sm" variant="secondary" disabled={!newHeader.trim()}>
          Agregar
        </Button>
      </form>

      {usedTargets.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Datos obligatorios para crear el lead</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700">
            {usedTargets.map((t) => (
              <label key={t} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-500"
                  checked={required.includes(t)}
                  onChange={(e) => setRequired(e.target.checked ? [...required, t] : required.filter((r) => r !== t))}
                />
                {labelOf(t)}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Si a una fila le falta alguno, no se crea el lead y queda registrada con error para corregirla.</p>
        </fieldset>
      )}

      {testResult && (
        <div className={`animate-fade-in rounded-xl px-3 py-2 text-sm ${testResult.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`} role="status">
          {testResult.ok ? (
            <>
              Con esa fila se crearía el lead <strong>{String((testResult.data as { name?: string })?.name ?? (testResult.data as { email?: string })?.email ?? "sin nombre")}</strong>
              {(testResult.data as { email?: string })?.email ? ` · ${(testResult.data as { email?: string }).email}` : ""}
              {(testResult.data as { phone?: string })?.phone ? ` · ${(testResult.data as { phone?: string }).phone}` : ""}.
            </>
          ) : (
            <>No se crearía: {testResult.errors?.join(" · ")}</>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} loading={saving} disabled={headers.length === 0}>
          {saving ? "Guardando…" : "Guardar mapeo"}
        </Button>
        <Button size="sm" variant="secondary" onClick={test} loading={testing} disabled={headers.length === 0 || !hasSample}>
          Probar con el ejemplo
        </Button>
        {!hasSample && headers.length > 0 && <span className="self-center text-xs text-slate-500">Completá algún valor en «Ejemplo» para probar.</span>}
      </div>
    </div>
  );
}
