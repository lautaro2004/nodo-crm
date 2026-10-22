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
  customerEmail: string | null;
  message: string;
  status: string;
  // "web_form" | "whatsapp"
  source: string;
  qualificationStatus: string | null;
  createdAt: Date;
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
    source: row.source,
    qualificationStatus: row.qualificationStatus,
    createdAt: row.createdAt,
  };
}

// Consultas candidatas a Lead: las sin calificar (null — formulario web, o
// negocios sin calificación con IA) y las "qualified". Quedan afuera las
// "pending" (la IA de Nexo todavía no decidió: se sincronizan cuando pasen a
// "qualified") y las "discarded" (no son potenciales clientes para este
// negocio; quedan solo en Consultas de Nexo). OR explícito porque en SQL un
// `IN (...)` nunca matchea NULL.
// `since`: a diferencia de los turnos, filtra por updatedAt (no createdAt):
// una consulta puede pasar de "pending" a "qualified" días después de
// creada (la IA con más mensajes, o el dueño a mano), y ese cambio la vuelve
// recién ahí candidata — el cron tiene que verla aunque sea vieja.
export async function listNexoInquiries(businessId: string, options: { since?: Date } = {}): Promise<NexoInquiry[]> {
  const rows = await prisma.inquiry.findMany({
    where: {
      businessId,
      OR: [{ qualificationStatus: null }, { qualificationStatus: "qualified" }],
      ...(options.since ? { updatedAt: { gte: options.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDomain);
}
