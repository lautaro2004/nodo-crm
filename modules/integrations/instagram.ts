import { prisma } from "@/lib/prisma";
import { integrationAad, openSecret, sealSecret } from "@/lib/crypto/secret-box";
import {
  REQUIRED_SCOPES,
  InstagramApiError,
  exchangeCode,
  exchangeLongLived,
  getAccount,
  getInstagramAppConfig,
  getSenderProfile,
  refreshLongLived,
  subscribeToMessages,
  unsubscribe,
} from "@/lib/instagram/graph";
import { parseInstagramConfig, type InstagramConfig } from "@/modules/integrations/config";
import { beginEvent, failEvent, finishEvent, safeErrorMessage, upsertLeadFromSource, type IntegrationRef } from "@/modules/integrations/ingest";
import { createActivity } from "@/modules/activities/service";

// ═══ Instagram (API con Instagram Login) ═════════════════════════════════
// - Conexión: OAuth oficial (Business Login) iniciado por un owner/admin
//   desde Nodo. El token largo (60 días) se guarda cifrado, ligado al
//   negocio y a la integración. Se renueva antes de vencer (cron).
// - A qué negocio pertenece cada webhook: entry[].id = ID de la cuenta
//   profesional conectada → LeadIntegration.externalAccountId (único por
//   tipo: una cuenta solo puede estar vinculada a un negocio).
// - Criterio de leads: un lead por persona (sourceRef = su IGSID). El
//   primer mensaje de alguien desconocido lo crea (configurable); los
//   siguientes se registran como actividad. Mensajes del propio negocio
//   (echo) nunca crean leads.

const SOURCE = "instagram";
const MAX_MESSAGE = 1000;

export type ConnectResult =
  | { ok: true; integrationId: string; username: string | null; webhookSubscribed: boolean; missingScopes: string[] }
  | { ok: false; reason: string };

function sealToken(businessId: string, integrationId: string, token: string) {
  return sealSecret(token, integrationAad(businessId, integrationId));
}

export function readToken(integration: { id: string; businessId: string; secretEnc: string | null }): string | null {
  if (!integration.secretEnc) return null;
  try {
    return openSecret(integration.secretEnc, integrationAad(integration.businessId, integration.id));
  } catch {
    return null;
  }
}

export async function completeInstagramConnection(scope: { businessId: string; userId: string }, code: string): Promise<ConnectResult> {
  const config = getInstagramAppConfig();
  if (!config) return { ok: false, reason: "not_configured" };

  let shortToken;
  try {
    shortToken = await exchangeCode(config, code);
  } catch (err) {
    console.error(`[integrations/instagram] intercambio de código falló: ${err instanceof InstagramApiError ? `${err.status} ${err.detail ?? ""}` : "error"}`);
    return { ok: false, reason: "token_exchange_failed" };
  }
  const missingScopes = REQUIRED_SCOPES.filter((s) => !shortToken.permissions.includes(s));
  // Sin permiso de mensajes no hay integración posible: no se guarda nada.
  if (missingScopes.includes("instagram_business_manage_messages")) return { ok: false, reason: "missing_permissions" };

  let longToken;
  let account;
  try {
    longToken = await exchangeLongLived(config, shortToken.accessToken);
    account = await getAccount(config, longToken.accessToken);
  } catch (err) {
    console.error(`[integrations/instagram] token largo / cuenta falló: ${err instanceof InstagramApiError ? `${err.status} ${err.detail ?? ""}` : "error"}`);
    return { ok: false, reason: "account_lookup_failed" };
  }

  // Una cuenta de Instagram solo puede estar vinculada a UN negocio.
  const other = await prisma.leadIntegration.findFirst({
    where: { type: "instagram", externalAccountId: account.igUserId, NOT: { businessId: scope.businessId } },
    select: { id: true, status: true },
  });
  if (other && other.status !== "disconnected") return { ok: false, reason: "account_linked_elsewhere" };
  if (other) await prisma.leadIntegration.update({ where: { id: other.id }, data: { externalAccountId: null } });

  // Una integración de Instagram por negocio: se reutiliza si existe.
  const current = await prisma.leadIntegration.findFirst({ where: { businessId: scope.businessId, type: "instagram" }, orderBy: { createdAt: "asc" } });
  const prevConfig = parseInstagramConfig(current?.config);
  const integration =
    current ??
    (await prisma.leadIntegration.create({
      data: { businessId: scope.businessId, type: "instagram", name: "Instagram", status: "pending", config: prevConfig },
    }));

  let webhookSubscribed = false;
  try {
    webhookSubscribed = await subscribeToMessages(config, account.igUserId, longToken.accessToken);
  } catch (err) {
    console.error(`[integrations/instagram] suscripción de webhooks falló: ${err instanceof InstagramApiError ? `${err.status} ${err.detail ?? ""}` : "error"}`);
  }

  const nextConfig: InstagramConfig = { ...prevConfig, missingScopes, webhookSubscribed };
  await prisma.leadIntegration.update({
    where: { id: integration.id },
    data: {
      name: account.username ? `@${account.username}` : "Instagram",
      externalAccountId: account.igUserId,
      externalUsername: account.username,
      secretEnc: sealToken(scope.businessId, integration.id, longToken.accessToken),
      tokenExpiresAt: longToken.expiresAt,
      scopes: shortToken.permissions,
      connectedById: scope.userId,
      status: webhookSubscribed ? "active" : "error",
      config: nextConfig,
      lastError: webhookSubscribed ? null : "No pudimos activar la recepción de mensajes (webhooks) para esta cuenta.",
      lastErrorAt: webhookSubscribed ? null : new Date(),
    },
  });
  return { ok: true, integrationId: integration.id, username: account.username, webhookSubscribed, missingScopes };
}

export async function disconnectInstagram(businessId: string, integrationId: string) {
  const integration = await prisma.leadIntegration.findFirst({ where: { id: integrationId, businessId, type: "instagram" } });
  if (!integration) throw new Error("integration_not_found");
  const config = getInstagramAppConfig();
  const token = readToken(integration);
  if (config && token && integration.externalAccountId) {
    // Best effort: si Meta no responde, igual se borra el token de Nodo.
    await unsubscribe(config, integration.externalAccountId, token).catch(() => undefined);
  }
  await prisma.leadIntegration.update({
    where: { id: integration.id },
    data: { status: "disconnected", secretEnc: null, tokenExpiresAt: null, scopes: [], externalAccountId: null },
  });
}

/** Renueva tokens que vencen en menos de 10 días (y tienen más de 24 h). */
export async function refreshInstagramTokens(now = new Date()) {
  const soon = new Date(now.getTime() + 10 * 24 * 3600 * 1000);
  const items = await prisma.leadIntegration.findMany({
    where: { type: "instagram", secretEnc: { not: null }, status: { in: ["active", "paused", "error"] }, tokenExpiresAt: { lte: soon } },
  });
  let refreshed = 0;
  let failed = 0;
  for (const integration of items) {
    const token = readToken(integration);
    if (!token) continue;
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < now) {
      await prisma.leadIntegration.update({
        where: { id: integration.id },
        data: { status: "error", lastError: "El acceso a Instagram venció. Volvé a conectar la cuenta.", lastErrorAt: now },
      });
      failed++;
      continue;
    }
    try {
      const next = await refreshLongLived(token);
      await prisma.leadIntegration.update({
        where: { id: integration.id },
        data: { secretEnc: sealToken(integration.businessId, integration.id, next.accessToken), tokenExpiresAt: next.expiresAt },
      });
      refreshed++;
    } catch {
      failed++;
      await prisma.leadIntegration.update({
        where: { id: integration.id },
        data: { lastError: "No pudimos renovar el acceso a Instagram. Si persiste, volvé a conectar la cuenta.", lastErrorAt: now },
      });
    }
  }
  return { checked: items.length, refreshed, failed };
}

// ─── Webhooks ───────────────────────────────────────────────────────────

interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean; is_self?: boolean; attachments?: { type?: string }[] };
}

export interface WebhookProcessSummary {
  entries: number;
  unknownAccount: number;
  processed: number;
  duplicates: number;
  skipped: number;
  failed: number;
}

function describeMessage(message: NonNullable<MessagingEvent["message"]>): string {
  const text = (message.text ?? "").trim().slice(0, MAX_MESSAGE);
  if (text) return text;
  const types = (message.attachments ?? []).map((a) => a.type).filter(Boolean);
  return types.length ? `[Adjunto: ${types.join(", ")}]` : "[Mensaje sin texto]";
}

/**
 * Procesa un payload de webhook YA validado (firma) con objeto "instagram".
 * Nunca lanza: los errores quedan registrados por evento.
 */
export async function processInstagramWebhook(payload: unknown): Promise<WebhookProcessSummary> {
  const summary: WebhookProcessSummary = { entries: 0, unknownAccount: 0, processed: 0, duplicates: 0, skipped: 0, failed: 0 };
  const root = payload as { object?: string; entry?: unknown };
  if (root?.object !== "instagram" || !Array.isArray(root.entry)) return summary;

  for (const rawEntry of root.entry.slice(0, 50)) {
    const entry = rawEntry as { id?: string; messaging?: MessagingEvent[] };
    summary.entries++;
    if (!entry?.id || !Array.isArray(entry.messaging)) continue;
    const integration = await prisma.leadIntegration.findFirst({
      where: { type: "instagram", externalAccountId: String(entry.id), status: { in: ["active", "error"] } },
    });
    if (!integration) {
      summary.unknownAccount++;
      continue;
    }
    for (const event of entry.messaging.slice(0, 100)) {
      const r = await processMessagingEvent(integration, String(entry.id), event);
      summary[r]++;
    }
  }
  return summary;
}

type EventOutcome = "processed" | "duplicates" | "skipped" | "failed";

async function processMessagingEvent(
  integration: IntegrationRef & { secretEnc: string | null; config: unknown },
  accountId: string,
  event: MessagingEvent
): Promise<EventOutcome> {
  const message = event.message;
  const mid = message?.mid;
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  // Solo eventos de mensajes con estructura válida (lecturas, reacciones,
  // etc. se ignoran por ahora).
  if (!message || !mid || !senderId || !recipientId) return "skipped";
  if (message.is_deleted) return "skipped";

  const isEcho = message.is_echo === true || senderId === accountId;
  const personId = isEcho ? recipientId : senderId;
  const config = parseInstagramConfig(integration.config);
  const text = describeMessage(message);
  const at = event.timestamp ? new Date(event.timestamp) : new Date();

  const begin = await beginEvent(integration, {
    externalId: mid.slice(0, 200),
    kind: isEcho ? "echo" : "message",
    data: { personId, text, at: at.toISOString() },
  });
  if (begin.state === "done" || begin.state === "in_progress") return "duplicates";
  return runMessage(integration, begin.eventId, { personId, text, at, isEcho }, config);
}

/** Reintento manual de un evento fallido con los datos guardados. */
export async function retryInstagramEvent(
  integration: IntegrationRef & { secretEnc: string | null; config: unknown },
  event: { id: string; kind: string; data: unknown }
) {
  const d = (event.data ?? {}) as { personId?: string; text?: string; at?: string };
  if (!d.personId) throw new Error("event_not_retryable");
  return runMessage(
    integration,
    event.id,
    { personId: d.personId, text: d.text ?? "", at: d.at ? new Date(d.at) : new Date(), isEcho: event.kind === "echo" },
    parseInstagramConfig(integration.config)
  );
}

async function runMessage(
  integration: IntegrationRef & { secretEnc: string | null },
  eventId: string,
  msg: { personId: string; text: string; at: Date; isEcho: boolean },
  config: InstagramConfig
): Promise<EventOutcome> {
  try {
    if (msg.isEcho) {
      // Respuesta del negocio: nunca crea leads; solo historial si ya existe.
      const lead = await prisma.lead.findUnique({
        where: { businessId_source_sourceRef: { businessId: integration.businessId, source: SOURCE, sourceRef: msg.personId } },
        select: { id: true },
      });
      if (!lead || !config.logReplies) {
        await finishEvent(integration, eventId, { status: "skipped", outcome: lead ? "replies_off" : "no_lead" });
        return "skipped";
      }
      await createActivity(integration.businessId, { relatedType: "lead", relatedId: lead.id, type: "instagram_reply", body: msg.text });
      await finishEvent(integration, eventId, { status: "processed", outcome: "activity", leadId: lead.id });
      return "processed";
    }

    const existing = await prisma.lead.findUnique({
      where: { businessId_source_sourceRef: { businessId: integration.businessId, source: SOURCE, sourceRef: msg.personId } },
      select: { id: true },
    });
    // El perfil se consulta solo para personas nuevas (una llamada por
    // persona, no por mensaje).
    let profile = { name: null as string | null, username: null as string | null };
    if (!existing && config.createLeadOnFirstMessage) {
      const appConfig = getInstagramAppConfig();
      const token = readToken(integration);
      if (appConfig && token) profile = await getSenderProfile(appConfig, msg.personId, token);
    }
    const fallbackName = `Instagram · ${msg.personId.slice(-6)}`;
    const name = profile.name ?? (profile.username ? `@${profile.username}` : null);
    const result = await upsertLeadFromSource(integration.businessId, {
      source: SOURCE,
      sourceRef: msg.personId,
      data: { name, email: null, phone: null, note: msg.text, custom: {} },
      activity: { type: "instagram_message", body: profile.username ? `@${profile.username}: ${msg.text}` : msg.text },
      createIfMissing: config.createLeadOnFirstMessage,
      fallbackName,
    });
    if (result.outcome === "skipped") {
      await finishEvent(integration, eventId, { status: "skipped", outcome: result.reason });
      return "skipped";
    }
    await finishEvent(integration, eventId, { status: "processed", outcome: result.outcome, leadId: "leadId" in result ? result.leadId : null });
    return "processed";
  } catch (err) {
    const error = safeErrorMessage(err);
    console.error(`[integrations/instagram] mensaje falló (${integration.id}): ${error}`);
    await failEvent(integration, eventId, error).catch(() => undefined);
    return "failed";
  }
}
