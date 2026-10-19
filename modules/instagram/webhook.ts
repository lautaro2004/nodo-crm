// Webhook de Instagram (Instagram Messaging API, app "Kodexa Connect").
// ETAPA ACTUAL: solo verificación + registro seguro de eventos. No guarda
// mensajes ni crea leads (eso viene después, con su propio diseño).

export interface WebhookSummary {
  object: string;
  entries: number;
  /** Conteo por tipo de evento, ej. { message: 1, read: 2 }. */
  events: Record<string, number>;
  /** Eventos de prueba enviados desde el panel de Meta ("Test"). */
  test: boolean;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

// Tipo de cada evento dentro de `messaging[]` (mensajes directos).
const MESSAGING_KINDS = ["message", "message_edit", "reaction", "read", "postback", "referral", "optin", "message_reactions"] as const;

function messagingKind(event: Json): string {
  for (const k of MESSAGING_KINDS) if (k in event) {
    if (k === "message" && isObj(event.message) && event.message.is_echo === true) return "message_echo";
    return k;
  }
  return "other";
}

/**
 * Resume el payload SIN datos personales: solo tipos y cantidades. Nunca
 * incluye textos de mensajes, IDs de usuarios ni adjuntos — es lo único
 * que se escribe en los logs.
 */
export function summarizeWebhook(payload: unknown): WebhookSummary {
  const summary: WebhookSummary = { object: "unknown", entries: 0, events: {}, test: false };
  if (!isObj(payload)) return summary;
  summary.object = typeof payload.object === "string" ? payload.object.slice(0, 40) : "unknown";
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  summary.entries = entries.length;
  const add = (k: string) => (summary.events[k] = (summary.events[k] ?? 0) + 1);

  for (const entry of entries) {
    if (!isObj(entry)) continue;
    for (const ev of Array.isArray(entry.messaging) ? entry.messaging : []) {
      if (!isObj(ev)) continue;
      add(messagingKind(ev));
      // El botón "Test" del panel manda eco de la propia cuenta.
      if (isObj(ev.message) && ev.message.is_echo === true && ev.message.is_self === true) summary.test = true;
    }
    for (const ch of Array.isArray(entry.changes) ? entry.changes : []) {
      if (isObj(ch)) add(`change:${typeof ch.field === "string" ? ch.field.slice(0, 40) : "unknown"}`);
    }
  }
  return summary;
}

export function formatSummary(s: WebhookSummary) {
  const events = Object.entries(s.events)
    .map(([k, n]) => `${k}=${n}`)
    .join(" ");
  return `object=${s.object} entries=${s.entries}${events ? ` ${events}` : ""}${s.test ? " test=true" : ""}`;
}
