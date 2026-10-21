import { prisma } from "@/lib/prisma";
import { upsertLeadFromSource, type UpsertOutcome } from "@/modules/integrations/ingest";
import { normalizeEmail, normalizePhone } from "@/modules/integrations/normalize";
import { getNexoInquiry, type NexoInquiry } from "@/modules/nexo/inquiries";

// Crea o actualiza el lead de Nodo para una consulta / interesado de Nexo.
// Nexo solo avisa QUÉ consulta procesar (businessId + id, ver
// app/api/internal/nexo-inquiry/route.ts): los datos se leen acá de
// nexo.Inquiry, con el mismo adaptador de solo lectura de siempre, y pasan
// por la capa común de ingestión (dedupe por origen, email o teléfono; solo
// completa datos vacíos; deja una actividad en el lead).

export const NEXO_INQUIRY_SOURCE = "nexo_inquiry";

export type NexoIngestResult =
  | { outcome: "no_workspace" }
  | { outcome: "not_found" }
  | (UpsertOutcome & { leadId?: string | null });

export function nexoInquiryActivityBody(inquiry: NexoInquiry): string {
  if (inquiry.channel === "whatsapp") {
    return [
      "Interesado registrado por el asistente de Nexo (WhatsApp).",
      inquiry.need ? `Necesita: ${inquiry.need}` : null,
      inquiry.summary ? `Resumen: ${inquiry.summary}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return `Consulta desde el sitio web (Nexo): ${inquiry.message}`;
}

export function nexoInquiryLeadData(inquiry: NexoInquiry) {
  const email = normalizeEmail(inquiry.customerEmail);
  const phone = normalizePhone(inquiry.customerWhatsapp);
  return {
    name: inquiry.customerName.trim() || null,
    email: email === "invalid" ? null : email,
    phone: phone === "invalid" ? null : phone,
    note: null,
    custom: {},
  };
}

export async function ingestNexoInquiry(businessId: string, inquiryId: string): Promise<NexoIngestResult> {
  const workspace = await prisma.workspace.findUnique({ where: { businessId }, select: { businessId: true } });
  if (!workspace) return { outcome: "no_workspace" };

  const inquiry = await getNexoInquiry(businessId, inquiryId);
  if (!inquiry) return { outcome: "not_found" };

  const data = nexoInquiryLeadData(inquiry);
  return upsertLeadFromSource(businessId, {
    source: NEXO_INQUIRY_SOURCE,
    sourceRef: inquiry.id,
    data,
    activity: { type: "note", body: nexoInquiryActivityBody(inquiry) },
    createIfMissing: true,
    fallbackName: data.name ?? "Interesado de Nexo",
  });
}
