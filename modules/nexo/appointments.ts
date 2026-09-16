import { prisma } from "@/lib/prisma";

// ── Adapter de solo lectura hacia nexo.Appointment ──────────────────────
// ÚNICO archivo autorizado a importar el modelo Prisma `Appointment`
// (mirror de nexo.Appointment, ver prisma/schema.prisma) — el resto de la
// aplicación consume exclusivamente el tipo `NexoAppointment` de acá
// abajo, nunca el tipo generado por Prisma. Esto es lo que impide que el
// modelo de Nexo se "filtre" por toda la app (ver
// docs/architecture/crm-fase4-nexo-leads.md, "Capa de integración").
//
// Contrato: solo lectura. Ninguna función de este archivo escribe en
// nexo.*. `businessId` es siempre el primer argumento y siempre viene de
// `resolveWorkspaceContext()` en el caller — nunca de un id enviado por
// el cliente (mismo principio que el resto de los módulos del Core).

export interface NexoAppointment {
  id: string;
  businessId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  date: string;
  startTime: string;
  status: string;
  createdAt: Date;
}

function toDomain(row: {
  id: string;
  businessId: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  date: string;
  startTime: string;
  status: string;
  createdAt: Date;
}): NexoAppointment {
  return {
    id: row.id,
    businessId: row.businessId,
    serviceName: row.serviceName,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    date: row.date,
    startTime: row.startTime,
    status: row.status,
    createdAt: row.createdAt,
  };
}

// Todos los turnos de ESTE negocio — no hay forma de distinguir a nivel de
// dato un turno originado por un cliente real de uno cargado a mano por el
// dueño desde el dashboard de Nexo (Appointment no persiste esa
// distinción — ver auditoría en crm-fase4-nexo-leads.md). Se documenta
// como limitación conocida, no se resuelve modificando Nexo en esta fase.
export async function listNexoAppointments(businessId: string): Promise<NexoAppointment[]> {
  const rows = await prisma.appointment.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDomain);
}

// Lectura puntual, para el detalle de un Lead — SIEMPRE scopeada por
// businessId además del id: un sourceRef guardado en un Lead de OTRO
// negocio nunca debe poder leer un turno ajeno, aunque alguien adivinara
// el id.
export async function getNexoAppointment(businessId: string, id: string): Promise<NexoAppointment | null> {
  const row = await prisma.appointment.findFirst({ where: { id, businessId } });
  return row ? toDomain(row) : null;
}
