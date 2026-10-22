import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createLead } from "@/modules/leads/service";
import { createActivity, type ActivityType } from "@/modules/activities/service";
import { phoneMatchKey, type NormalizedLeadData } from "@/modules/integrations/normalize";

// ═══ Capa común de ingestión ═════════════════════════════════════════════
// Todas las fuentes (Google Sheets, Instagram, futuras) pasan por acá:
//
//   1. beginEvent: registra el evento con su ID externo. El índice único
//      (integrationId, externalId) es la garantía de idempotencia: un
//      reintento del mismo evento nunca se procesa dos veces.
//   2. upsertLeadFromSource: aplica las reglas de negocio y crea el lead con
//      el flujo existente (createLead: validaciones, "Lead creado",
//      asignación automática) o registra actividad en uno existente.
//   3. finishEvent / failEvent: el evento queda "processed" recién cuando
//      todo terminó; si algo falla queda "failed" con el motivo, para
//      reintentar.
//
// Aislamiento: el businessId SIEMPRE sale de la integración (resuelta en el
// servidor), nunca del payload externo.

export interface IntegrationRef {
  id: string;
  businessId: string;
  type: string;
}

type BeginResult =
  | { state: "new"; eventId: string }
  | { state: "retry"; eventId: string; attempts: number }
  | { state: "done"; eventId: string; status: string; outcome: string | null; leadId: string | null }
  | { state: "in_progress"; eventId: string };

/** Un evento "received" más viejo que esto se considera abandonado (crash) y se puede reprocesar. */
const STALE_MS = 2 * 60 * 1000;

export async function beginEvent(
  integration: IntegrationRef,
  input: { externalId: string; kind: string; data?: Prisma.InputJsonValue | null }
): Promise<BeginResult> {
  try {
    const created = await prisma.ingestionEvent.create({
      data: {
        businessId: integration.businessId,
        integrationId: integration.id,
        externalId: input.externalId,
        kind: input.kind,
        data: input.data ?? Prisma.JsonNull,
      },
      select: { id: true },
    });
    return { state: "new", eventId: created.id };
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
  }

  const existing = await prisma.ingestionEvent.findUnique({
    where: { integrationId_externalId: { integrationId: integration.id, externalId: input.externalId } },
  });
  if (!existing) throw new Error("event_lookup_failed");
  if (existing.status === "processed" || existing.status === "skipped") {
    return { state: "done", eventId: existing.id, status: existing.status, outcome: existing.outcome, leadId: existing.leadId };
  }
  if (existing.status === "received" && Date.now() - existing.receivedAt.getTime() < STALE_MS) {
    return { state: "in_progress", eventId: existing.id };
  }
  // "failed" (o "received" abandonado): se reintenta con los datos nuevos.
  // updateMany con condición = solo un request gana el reintento.
  const claimed = await prisma.ingestionEvent.updateMany({
    where: { id: existing.id, status: existing.status, attempts: existing.attempts },
    data: {
      status: "received",
      attempts: { increment: 1 },
      error: null,
      receivedAt: new Date(),
      ...(input.data !== undefined ? { data: input.data ?? Prisma.JsonNull } : {}),
    },
  });
  if (claimed.count === 0) return { state: "in_progress", eventId: existing.id };
  return { state: "retry", eventId: existing.id, attempts: existing.attempts + 1 };
}

export async function finishEvent(
  integration: IntegrationRef,
  eventId: string,
  result: { status: "processed" | "skipped"; outcome?: string | null; leadId?: string | null }
) {
  const now = new Date();
  await prisma.ingestionEvent.update({
    where: { id: eventId },
    data: { status: result.status, outcome: result.outcome ?? null, leadId: result.leadId ?? null, error: null, processedAt: now },
  });
  await prisma.leadIntegration.update({
    where: { id: integration.id },
    data: { lastEventAt: now, ...(result.status === "processed" ? { lastSuccessAt: now } : {}) },
  });
}

export async function failEvent(integration: IntegrationRef, eventId: string, error: string) {
  const now = new Date();
  const message = error.slice(0, 500);
  await prisma.ingestionEvent.update({ where: { id: eventId }, data: { status: "failed", error: message, processedAt: now } });
  await prisma.leadIntegration.update({
    where: { id: integration.id },
    data: { lastEventAt: now, lastErrorAt: now, lastError: message },
  });
}

// ─── Reglas de creación / actualización ─────────────────────────────────

export interface UpsertLeadInput {
  /** Valor de Lead.source (ej. "instagram", "google_sheets"). */
  source: string;
  /** Identificador estable en la fuente (remitente de IG, fila de Sheets). */
  sourceRef: string;
  data: NormalizedLeadData;
  /** Texto de la actividad que deja constancia del ingreso. */
  activity: { type: ActivityType; body: string };
  /** Si no existe nada asociado, ¿se crea un lead? */
  createIfMissing: boolean;
  /** Nombre a usar si la fuente no trae ninguno. */
  fallbackName: string;
}

export type UpsertOutcome =
  | { outcome: "created"; leadId: string }
  | { outcome: "updated"; leadId: string; filled: string[] }
  | { outcome: "matched_contact"; contactId: string }
  | { outcome: "skipped"; reason: string };

/** Busca un lead del MISMO negocio por email o teléfono (nunca por nombre). */
export async function findLeadByContactData(businessId: string, email: string | null, phone: string | null) {
  if (email) {
    const byEmail = await prisma.lead.findFirst({
      where: { businessId, email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });
    if (byEmail) return byEmail;
  }
  const key = phoneMatchKey(phone);
  if (key) {
    // Los teléfonos cargados a mano tienen formatos variados ("+54 9 11
    // 4444-0000", "011 4444 0000"): se comparan solo los dígitos finales.
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "crm"."Lead"
      WHERE "businessId" = ${businessId} AND phone IS NOT NULL
        AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${key}
      ORDER BY "createdAt" ASC LIMIT 1`;
    if (rows[0]) return prisma.lead.findUnique({ where: { id: rows[0].id } });
  }
  return null;
}

async function findContactByContactData(businessId: string, email: string | null, phone: string | null) {
  if (email) {
    const byEmail = await prisma.contact.findFirst({ where: { businessId, email: { equals: email, mode: "insensitive" } } });
    if (byEmail) return byEmail;
  }
  const key = phoneMatchKey(phone);
  if (key) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "crm"."Contact"
      WHERE "businessId" = ${businessId} AND phone IS NOT NULL
        AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${key}
      ORDER BY "createdAt" ASC LIMIT 1`;
    if (rows[0]) return prisma.contact.findUnique({ where: { id: rows[0].id } });
  }
  return null;
}

/**
 * Completa SOLO datos vacíos de un lead existente: nunca pisa lo que ya
 * cargó el equipo (nombre, email, teléfono o campos personalizados).
 */
async function fillBlanks(
  businessId: string,
  lead: { id: string; name: string; email: string | null; phone: string | null },
  data: NormalizedLeadData,
  fallbackName: string
) {
  const filled: string[] = [];
  const update: { email?: string; phone?: string; name?: string } = {};
  if (!lead.email && data.email) update.email = data.email;
  if (!lead.phone && data.phone) update.phone = data.phone;
  // Un nombre automático ("Instagram · …") se reemplaza por el real si llega.
  if (data.name && lead.name === fallbackName && data.name !== fallbackName) update.name = data.name;
  if (Object.keys(update).length) {
    await prisma.lead.update({ where: { id: lead.id }, data: update });
    filled.push(...Object.keys(update));
  }
  const ids = Object.keys(data.custom);
  if (ids.length) {
    // Solo definiciones de leads de ESTE negocio.
    const defs = await prisma.customFieldDefinition.findMany({ where: { id: { in: ids }, businessId, entityType: "lead" }, select: { id: true } });
    const existing = await prisma.customFieldValue.findMany({ where: { entityId: lead.id, definitionId: { in: defs.map((d) => d.id) } }, select: { definitionId: true } });
    const taken = new Set(existing.map((v) => v.definitionId));
    for (const def of defs) {
      if (taken.has(def.id)) continue;
      await prisma.customFieldValue.create({ data: { definitionId: def.id, entityId: lead.id, value: data.custom[def.id] } });
      filled.push(`cf:${def.id}`);
    }
  }
  return filled;
}

async function setCustomValuesForNewLead(businessId: string, leadId: string, custom: Record<string, string>) {
  const ids = Object.keys(custom);
  if (!ids.length) return;
  const defs = await prisma.customFieldDefinition.findMany({ where: { id: { in: ids }, businessId, entityType: "lead" }, select: { id: true } });
  if (!defs.length) return;
  await prisma.customFieldValue.createMany({
    data: defs.map((d) => ({ definitionId: d.id, entityId: leadId, value: custom[d.id] })),
    skipDuplicates: true,
  });
}

export async function upsertLeadFromSource(businessId: string, input: UpsertLeadInput): Promise<UpsertOutcome> {
  const { data } = input;

  // 1. Mismo origen y misma referencia (ej. el mismo remitente de IG).
  let lead = await prisma.lead.findUnique({
    where: { businessId_source_sourceRef: { businessId, source: input.source, sourceRef: input.sourceRef } },
  });
  // 2. Mismo email o teléfono en otro lead del negocio.
  if (!lead) lead = await findLeadByContactData(businessId, data.email, data.phone);

  if (lead) {
    const filled = await fillBlanks(businessId, lead, data, input.fallbackName);
    await createActivity(businessId, { relatedType: "lead", relatedId: lead.id, ...input.activity });
    return { outcome: "updated", leadId: lead.id, filled };
  }

  // 3. Ya es un contacto (cliente): se deja constancia ahí, sin lead nuevo.
  const contact = await findContactByContactData(businessId, data.email, data.phone);
  if (contact) {
    await createActivity(businessId, { relatedType: "contact", relatedId: contact.id, ...input.activity });
    return { outcome: "matched_contact", contactId: contact.id };
  }

  if (!input.createIfMissing) return { outcome: "skipped", reason: "create_disabled" };

  // 4. Nuevo lead por el flujo existente.
  try {
    const created = await createLead(businessId, {
      name: data.name ?? input.fallbackName,
      email: data.email,
      phone: data.phone,
      source: input.source,
      sourceRef: input.sourceRef,
    });
    await setCustomValuesForNewLead(businessId, created.id, data.custom);
    await createActivity(businessId, { relatedType: "lead", relatedId: created.id, ...input.activity });
    return { outcome: "created", leadId: created.id };
  } catch (err) {
    // Carrera: otro request creó el mismo lead (mismo source+sourceRef)
    // entre la búsqueda y el create. El índice único lo impidió; se
    // registra como actualización del existente.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.lead.findUnique({
        where: { businessId_source_sourceRef: { businessId, source: input.source, sourceRef: input.sourceRef } },
      });
      if (existing) {
        await createActivity(businessId, { relatedType: "lead", relatedId: existing.id, ...input.activity });
        return { outcome: "updated", leadId: existing.id, filled: [] };
      }
    }
    throw err;
  }
}

/** Mensaje de error apto para mostrar/guardar (sin stack ni datos internos). */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `Error de base de datos (${err.code})`;
  if (err instanceof Error && /^[a-z_]+$/.test(err.message)) return err.message;
  return "Error inesperado al procesar";
}
