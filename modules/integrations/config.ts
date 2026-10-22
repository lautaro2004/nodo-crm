import { z } from "zod";

// Configuración de cada tipo de integración (columna LeadIntegration.config).

export const INTEGRATION_TYPES = ["google_sheets", "instagram"] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  google_sheets: "Google Sheets",
  instagram: "Instagram",
};

const mappingTarget = z.union([z.enum(["name", "email", "phone", "note", "ignore"]), z.string().regex(/^cf:[a-z0-9]{8,40}$/i)]);

export const sheetsConfigSchema = z.object({
  /** encabezado de la hoja → destino en Nodo */
  mapping: z.record(z.string().min(1).max(120), mappingTarget).default({}),
  /** destinos obligatorios (sin ellos la fila no crea lead) */
  required: z.array(z.string().max(60)).max(20).default(["name"]),
  /** encabezados detectados por la última prueba de conexión */
  headers: z.array(z.string().max(120)).max(100).default([]),
  spreadsheetName: z.string().max(200).nullable().optional(),
  sheetName: z.string().max(200).nullable().optional(),
  lastTestAt: z.string().nullable().optional(),
});
export type SheetsConfig = z.infer<typeof sheetsConfigSchema>;

export const instagramConfigSchema = z.object({
  /** Crear un lead cuando escribe por primera vez alguien que no está en Nodo. */
  createLeadOnFirstMessage: z.boolean().default(true),
  /** Registrar en el historial las respuestas enviadas desde la cuenta. */
  logReplies: z.boolean().default(true),
  /** Permisos que faltaron en la última conexión (diagnóstico). */
  missingScopes: z.array(z.string()).default([]),
  /** ¿Se activó la suscripción de webhooks para la cuenta? */
  webhookSubscribed: z.boolean().default(false),
  /** Último aviso de Meta recibido para esta cuenta (diagnóstico). */
  lastWebhookAt: z.string().nullable().optional(),
});
export type InstagramConfig = z.infer<typeof instagramConfigSchema>;

export function parseSheetsConfig(value: unknown): SheetsConfig {
  const parsed = sheetsConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : sheetsConfigSchema.parse({});
}

export function parseInstagramConfig(value: unknown): InstagramConfig {
  const parsed = instagramConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : instagramConfigSchema.parse({});
}

/** Cambios que la UI puede pedir (el resto lo maneja el servidor). */
export const sheetsConfigPatchSchema = sheetsConfigSchema.pick({ mapping: true, required: true }).partial();
export const instagramConfigPatchSchema = instagramConfigSchema.pick({ createLeadOnFirstMessage: true, logReplies: true }).partial();

export const integrationPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  status: z.enum(["active", "paused"]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
