import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { integrationAad, openSecret } from "@/lib/crypto/secret-box";
import { parseSheetsConfig, type SheetsConfig } from "@/modules/integrations/config";
import { mapRow, fallbackLeadName, type CustomFieldInfo, type MappingTarget } from "@/modules/integrations/normalize";
import { beginEvent, failEvent, finishEvent, safeErrorMessage, upsertLeadFromSource, type IntegrationRef } from "@/modules/integrations/ingest";

// ═══ Google Sheets vía Apps Script ═══════════════════════════════════════
// El script de la planilla del cliente envía las filas a
//   POST /api/integrations/sheets/<integrationId>/ingest
// firmadas con HMAC-SHA256(secreto, "<timestamp>.<cuerpo>"). El secreto es
// propio de la integración (se muestra una sola vez, se guarda cifrado) y
// vive en las propiedades del script, no en la hoja. La hoja puede ser
// privada: nadie comparte credenciales de Google con Nodo.

export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_ROWS_PER_REQUEST = 50;
/** Tolerancia de reloj / ventana anti-replay de la firma. */
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
/** Límite de frecuencia por integración (eventos por minuto). */
export const RATE_LIMIT_PER_MINUTE = 300;

export function signSheetsBody(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifySheetsSignature(
  secret: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  now = Date.now()
): "ok" | "missing" | "expired" | "invalid" {
  if (!timestamp || !signature) return "missing";
  const ts = Number(timestamp);
  // Apps Script manda milisegundos; se aceptan segundos también.
  const ms = ts > 1e12 ? ts : ts * 1000;
  if (!Number.isFinite(ms) || Math.abs(now - ms) > SIGNATURE_WINDOW_MS) return "expired";
  const expected = Buffer.from(signSheetsBody(secret, timestamp, rawBody));
  const given = Buffer.from(signature.replace(/^sha256=/, "").toLowerCase());
  return expected.length === given.length && timingSafeEqual(expected, given) ? "ok" : "invalid";
}

const cell = z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]);

export const sheetsPayloadSchema = z.object({
  /** Prueba de conexión: no procesa filas, solo informa encabezados. */
  test: z.boolean().optional(),
  spreadsheetName: z.string().max(200).optional(),
  sheetName: z.string().max(200).optional(),
  headers: z.array(z.string().max(120)).max(100).optional(),
  rows: z
    .array(
      z.object({
        rowId: z.string().trim().min(1).max(100),
        values: z.record(z.string().max(120), cell).refine((v) => Object.keys(v).length <= 100, "too_many_columns"),
      })
    )
    .max(MAX_ROWS_PER_REQUEST)
    .optional(),
});
export type SheetsPayload = z.infer<typeof sheetsPayloadSchema>;

export interface RowResult {
  rowId: string;
  status: "processed" | "skipped" | "failed" | "duplicate" | "in_progress";
  outcome?: string | null;
  error?: string;
}

export async function loadSheetsIntegration(integrationId: string) {
  return prisma.leadIntegration.findFirst({ where: { id: integrationId, type: "google_sheets" } });
}

export function sheetsSecret(integration: { id: string; businessId: string; secretEnc: string | null }): string | null {
  if (!integration.secretEnc) return null;
  try {
    return openSecret(integration.secretEnc, integrationAad(integration.businessId, integration.id));
  } catch {
    return null;
  }
}

export async function leadCustomFields(businessId: string): Promise<CustomFieldInfo[]> {
  const defs = await prisma.customFieldDefinition.findMany({
    where: { businessId, entityType: "lead" },
    select: { id: true, label: true, type: true, options: true },
  });
  // Relaciones e imágenes tienen su propio flujo: no se mapean desde texto.
  return defs.filter((d) => d.type !== "relation" && d.type !== "image" && d.type !== "file");
}

/** Solo las columnas mapeadas se guardan en el evento (minimización). */
function pickMapped(values: Record<string, unknown>, config: SheetsConfig) {
  const out: Record<string, string> = {};
  for (const [header, target] of Object.entries(config.mapping)) {
    if (target === "ignore") continue;
    const v = values[header];
    if (v !== null && v !== undefined && String(v).trim()) out[header] = String(v).slice(0, 2000);
  }
  return out;
}

export async function processSheetsRow(
  integration: IntegrationRef & { name: string; config: unknown },
  row: { rowId: string; values: Record<string, unknown> },
  customFields?: CustomFieldInfo[]
): Promise<RowResult> {
  const config = parseSheetsConfig(integration.config);
  const values = pickMapped(row.values, config);
  const begin = await beginEvent(integration, { externalId: row.rowId, kind: "row", data: { values } });
  if (begin.state === "done") return { rowId: row.rowId, status: "duplicate", outcome: begin.outcome };
  if (begin.state === "in_progress") return { rowId: row.rowId, status: "in_progress" };
  return runRow(integration, begin.eventId, row.rowId, values, config, customFields);
}

/** Reprocesa un evento fallido con los datos guardados (botón "Reintentar"). */
export async function retrySheetsEvent(integration: IntegrationRef & { name: string; config: unknown }, event: { id: string; externalId: string; data: unknown }) {
  const config = parseSheetsConfig(integration.config);
  const values = ((event.data as { values?: Record<string, string> } | null)?.values ?? {}) as Record<string, string>;
  return runRow(integration, event.id, event.externalId, values, config);
}

async function runRow(
  integration: IntegrationRef & { name: string },
  eventId: string,
  rowId: string,
  values: Record<string, unknown>,
  config: SheetsConfig,
  customFields?: CustomFieldInfo[]
): Promise<RowResult> {
  try {
    const cfs = customFields ?? (await leadCustomFields(integration.businessId));
    const mapped = mapRow(values, config.mapping as Record<string, MappingTarget>, config.required, cfs);
    if (!mapped.ok) {
      const error = mapped.errors.join(" · ");
      await failEvent(integration, eventId, error);
      return { rowId, status: "failed", error };
    }
    const sourceLabel = `Google Sheets (${integration.name})`;
    const result = await upsertLeadFromSource(integration.businessId, {
      source: "google_sheets",
      // Identificador estable: integración + ID de fila generado por el script.
      sourceRef: `${integration.id}:${rowId}`,
      data: mapped.data,
      activity: {
        type: "sheets_submission",
        body: [`Ingresó desde ${sourceLabel}.`, mapped.data.note].filter(Boolean).join("\n"),
      },
      createIfMissing: true,
      fallbackName: fallbackLeadName(mapped.data, "Google Sheets"),
    });
    if (result.outcome === "skipped") {
      await finishEvent(integration, eventId, { status: "skipped", outcome: result.reason });
      return { rowId, status: "skipped", outcome: result.reason };
    }
    const leadId = "leadId" in result ? result.leadId : null;
    await finishEvent(integration, eventId, { status: "processed", outcome: result.outcome, leadId });
    return { rowId, status: "processed", outcome: result.outcome };
  } catch (err) {
    const error = safeErrorMessage(err);
    console.error(`[integrations/sheets] fila falló (${integration.id}): ${error}`);
    await failEvent(integration, eventId, error).catch(() => undefined);
    return { rowId, status: "failed", error };
  }
}

export async function recentEventCount(integrationId: string, windowMs = 60_000) {
  return prisma.ingestionEvent.count({ where: { integrationId, receivedAt: { gte: new Date(Date.now() - windowMs) } } });
}
