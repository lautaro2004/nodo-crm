import { prisma } from "@/lib/prisma";

// ── Adapter de solo lectura hacia nexo.Inquiry ──────────────────────────
// ÚNICO archivo autorizado a importar el modelo Prisma `Inquiry` (mirror de
// nexo.Inquiry, ver prisma/schema.prisma) — mismo contrato que
// appointments.ts: solo lectura, `businessId` siempre primer argumento y
// siempre proveniente de la sesión, el resto de la app consume únicamente
// el tipo `NexoInquiry`.

export interface NexoInquiry {
  id: string;
  businessId: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string;
  message: string;
  status: string;
  createdAt: Date;
  /** "web" (formulario del sitio) | "whatsapp" (asistente de Nexo). */
  channel: string;
  need: string | null;
  summary: string | null;
  /** Lead de Nodo que ya se creó/actualizó para esta consulta (lo guarda Nexo). */
  nodoLeadId: string | null;
}

function toDomain(row: NexoInquiry): NexoInquiry {
  return {
    id: row.id,
    businessId: row.businessId,
    customerName: row.customerName,
    customerWhatsapp: row.customerWhatsapp,
    customerEmail: row.customerEmail,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    channel: row.channel,
    need: row.need,
    summary: row.summary,
    nodoLeadId: row.nodoLeadId,
  };
}

export async function listNexoInquiries(businessId: string): Promise<NexoInquiry[]> {
  const rows = await prisma.inquiry.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDomain);
}

export async function getNexoInquiry(businessId: string, id: string): Promise<NexoInquiry | null> {
  const row = await prisma.inquiry.findFirst({ where: { id, businessId } });
  return row ? toDomain(row) : null;
}
