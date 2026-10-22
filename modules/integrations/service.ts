import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { integrationAad, isEncryptionConfigured, sealSecret } from "@/lib/crypto/secret-box";
import { getInstagramAppConfig } from "@/lib/instagram/graph";
import {
  instagramConfigPatchSchema,
  parseInstagramConfig,
  parseSheetsConfig,
  sheetsConfigPatchSchema,
  type IntegrationType,
} from "@/modules/integrations/config";
import { leadCustomFields, retrySheetsEvent } from "@/modules/integrations/sheets";
import { disconnectInstagram, retryInstagramEvent } from "@/modules/integrations/instagram";

// Gestión de integraciones desde la UI (Configuración → Integraciones).
// Todo scopeado por businessId de la sesión; nunca devuelve secretos.

export const MAX_SHEETS_INTEGRATIONS = 10;

export interface IntegrationView {
  id: string;
  type: IntegrationType;
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
  /** URL a la que envía el Apps Script (solo Google Sheets). */
  endpoint: string | null;
  createdAt: string;
  stats: { processed: number; failed: number; last24h: number };
}

export function sheetsEndpoint(id: string): string {
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return new URL(`/api/integrations/sheets/${id}/ingest`, base).toString();
}

type Row = Awaited<ReturnType<typeof prisma.leadIntegration.findFirst>> & {};

function toView(i: NonNullable<Row>, stats: IntegrationView["stats"]): IntegrationView {
  const config = i.type === "instagram" ? parseInstagramConfig(i.config) : parseSheetsConfig(i.config);
  return {
    id: i.id,
    type: i.type as IntegrationType,
    name: i.name,
    status: i.status,
    externalUsername: i.externalUsername,
    config: config as Record<string, unknown>,
    tokenExpiresAt: i.tokenExpiresAt?.toISOString() ?? null,
    scopes: i.scopes,
    lastEventAt: i.lastEventAt?.toISOString() ?? null,
    lastSuccessAt: i.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: i.lastErrorAt?.toISOString() ?? null,
    lastError: i.lastError,
    hasSecret: !!i.secretEnc,
    endpoint: i.type === "google_sheets" ? sheetsEndpoint(i.id) : null,
    createdAt: i.createdAt.toISOString(),
    stats,
  };
}

export async function listIntegrations(businessId: string): Promise<IntegrationView[]> {
  const items = await prisma.leadIntegration.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
  if (!items.length) return [];
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const grouped = await prisma.ingestionEvent.groupBy({
    by: ["integrationId", "status"],
    where: { businessId, integrationId: { in: items.map((i) => i.id) } },
    _count: { _all: true },
  });
  const recent = await prisma.ingestionEvent.groupBy({
    by: ["integrationId"],
    where: { businessId, receivedAt: { gte: since } },
    _count: { _all: true },
  });
  return items.map((i) =>
    toView(i, {
      processed: grouped.find((g) => g.integrationId === i.id && g.status === "processed")?._count._all ?? 0,
      failed: grouped.find((g) => g.integrationId === i.id && g.status === "failed")?._count._all ?? 0,
      last24h: recent.find((r) => r.integrationId === i.id)?._count._all ?? 0,
    })
  );
}

export function integrationsEnvironment() {
  return { encryption: isEncryptionConfigured(), instagram: !!getInstagramAppConfig() };
}

async function getOwned(businessId: string, id: string) {
  const integration = await prisma.leadIntegration.findFirst({ where: { id, businessId } });
  if (!integration) throw new Error("integration_not_found");
  return integration;
}

function newSecret() {
  return randomBytes(32).toString("base64url");
}

/** Crea una conexión de Google Sheets. El secreto se devuelve UNA sola vez. */
export async function createSheetsIntegration(businessId: string, userId: string, name: string) {
  if (!isEncryptionConfigured()) throw new Error("encryption_not_configured");
  const count = await prisma.leadIntegration.count({ where: { businessId, type: "google_sheets" } });
  if (count >= MAX_SHEETS_INTEGRATIONS) throw new Error("too_many_integrations");
  const integration = await prisma.leadIntegration.create({
    data: { businessId, type: "google_sheets", name, status: "pending", connectedById: userId, config: parseSheetsConfig({}) },
  });
  const secret = newSecret();
  await prisma.leadIntegration.update({ where: { id: integration.id }, data: { secretEnc: sealSecret(secret, integrationAad(businessId, integration.id)) } });
  return { id: integration.id, secret, endpoint: sheetsEndpoint(integration.id) };
}

/** Rota el secreto: el anterior deja de funcionar en el acto. */
export async function rotateSheetsSecret(businessId: string, id: string) {
  const integration = await getOwned(businessId, id);
  if (integration.type !== "google_sheets") throw new Error("invalid_input");
  const secret = newSecret();
  await prisma.leadIntegration.update({ where: { id }, data: { secretEnc: sealSecret(secret, integrationAad(businessId, id)) } });
  return { secret };
}

export async function updateIntegration(
  businessId: string,
  id: string,
  patch: { name?: string; status?: "active" | "paused"; config?: Record<string, unknown> }
) {
  const integration = await getOwned(businessId, id);
  const data: Prisma.LeadIntegrationUpdateInput = {};
  if (patch.name) data.name = patch.name;

  let nextConfig: Record<string, unknown> | null = null;
  if (patch.config) {
    if (integration.type === "google_sheets") {
      const parsed = sheetsConfigPatchSchema.safeParse(patch.config);
      if (!parsed.success) throw new Error("invalid_config");
      // Solo campos personalizados de leads de ESTE negocio.
      const cfIds = new Set((await leadCustomFields(businessId)).map((f) => f.id));
      const mapping = parsed.data.mapping ?? {};
      for (const target of [...Object.values(mapping), ...(parsed.data.required ?? [])]) {
        if (target.startsWith("cf:") && !cfIds.has(target.slice(3))) throw new Error("invalid_config");
      }
      nextConfig = { ...parseSheetsConfig(integration.config), ...parsed.data };
    } else {
      const parsed = instagramConfigPatchSchema.safeParse(patch.config);
      if (!parsed.success) throw new Error("invalid_config");
      nextConfig = { ...parseInstagramConfig(integration.config), ...parsed.data };
    }
    data.config = nextConfig as Prisma.InputJsonValue;
  }

  if (patch.status) {
    if (integration.status === "disconnected" || !integration.secretEnc) throw new Error("integration_not_connected");
    if (patch.status === "active" && integration.type === "google_sheets") {
      const config = parseSheetsConfig(nextConfig ?? integration.config);
      const targets = Object.values(config.mapping).filter((t) => t !== "ignore");
      if (!targets.length) throw new Error("mapping_required");
    }
    data.status = patch.status;
    if (patch.status === "active") {
      data.lastError = null;
      data.lastErrorAt = null;
    }
  }
  await prisma.leadIntegration.update({ where: { id }, data });
}

export async function deleteIntegration(businessId: string, id: string) {
  const integration = await getOwned(businessId, id);
  if (integration.type === "instagram") {
    await disconnectInstagram(businessId, id);
    return;
  }
  await prisma.leadIntegration.delete({ where: { id } });
}

export async function listEvents(businessId: string, integrationId: string, limit = 30) {
  await getOwned(businessId, integrationId);
  const events = await prisma.ingestionEvent.findMany({
    where: { businessId, integrationId },
    orderBy: { receivedAt: "desc" },
    take: Math.min(limit, 100),
    select: { id: true, externalId: true, kind: true, status: true, outcome: true, error: true, leadId: true, attempts: true, receivedAt: true, processedAt: true },
  });
  return events.map((e) => ({ ...e, receivedAt: e.receivedAt.toISOString(), processedAt: e.processedAt?.toISOString() ?? null }));
}

/** Reintenta un evento fallido (con los datos ya guardados). */
export async function retryEvent(businessId: string, eventId: string) {
  const event = await prisma.ingestionEvent.findFirst({ where: { id: eventId, businessId } });
  if (!event) throw new Error("integration_not_found");
  if (event.status !== "failed") throw new Error("event_not_retryable");
  const integration = await getOwned(businessId, event.integrationId);
  if (integration.status === "disconnected") throw new Error("integration_not_connected");
  // Marca el reintento (un solo request gana).
  const claimed = await prisma.ingestionEvent.updateMany({
    where: { id: event.id, status: "failed" },
    data: { status: "received", attempts: { increment: 1 }, error: null, receivedAt: new Date() },
  });
  if (claimed.count === 0) throw new Error("event_not_retryable");
  if (integration.type === "google_sheets") {
    const r = await retrySheetsEvent(integration, event);
    return { status: r.status, error: r.error ?? null };
  }
  const r = await retryInstagramEvent(integration, event);
  return { status: r === "processed" ? "processed" : r === "failed" ? "failed" : "skipped", error: null };
}
