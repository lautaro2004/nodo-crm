import { prisma } from "@/lib/prisma";
import { listNexoAppointments } from "@/modules/nexo/appointments";
import { listNexoInquiries } from "@/modules/nexo/inquiries";
import { createActivity } from "@/modules/activities/service";

const SOURCE = "nexo_appointment";

export interface SyncLeadsResult {
  created: number;
  skipped: number;
  total: number;
}

// Sincronización Nexo -> Nodo: crear un crm.Lead por cada nexo.Appointment
// de este negocio que todavía no tenga uno. Ver
// docs/architecture/crm-fase4-nexo-leads.md para el razonamiento completo
// de cada decisión de abajo — resumen:
//
// - IDEMPOTENCIA: upsert por (businessId, source, sourceRef) — el mismo
//   Appointment.id nunca genera un segundo Lead, sin importar cuántas
//   veces se corra esta función (poll, botón manual, reintento).
// - REPROGRAMACIÓN: Appointment.id no cambia al reprogramar un turno
//   (rescheduleAppointment actualiza la misma fila) — un turno
//   reprogramado automáticamente NO duplica Lead, sin lógica extra acá.
// - CANCELACIÓN: esta función es CREATE-ONLY. Si el Lead ya existe, no se
//   toca (ni status, ni datos de contacto) — nunca pisa una decisión que
//   ya tomó un usuario del CRM sobre ese Lead. El estado actual del turno
//   en Nexo (cancelado, reprogramado, lo que sea) se ve siempre en vivo
//   en el detalle del Lead (ver getNexoAppointment), nunca se sincroniza
//   ni se cachea en la fila del Lead.
// - CLIENTE YA EXISTENTE: no se intenta deduplicar por teléfono/email
//   entre distintos turnos — cada Appointment genera, a lo sumo, un Lead
//   propio. Deduplicar por cliente es la conversión Lead->Contact
//   explícitamente pospuesta (ver Fase 3 y el pedido de esta fase).
// - DATOS INCOMPLETOS: Appointment.customerName/customerPhone son NOT
//   NULL en Nexo — nunca llegan vacíos acá. No hay email disponible (no
//   existe en el modelo de Nexo, confirmado por auditoría) — el Lead
//   sincronizado siempre queda con email: null.
export async function syncLeadsFromNexoAppointments(businessId: string): Promise<SyncLeadsResult> {
  const appointments = await listNexoAppointments(businessId);

  let created = 0;
  let skipped = 0;

  for (const appointment of appointments) {
    // Check-then-create explícito (no upsert): más simple de razonar y de
    // testear que inferir "fue create o update" a partir de timestamps
    // (@updatedAt puede tocar updatedAt incluso en un upsert con
    // update: {} — no es una señal confiable). Hay una ventana de carrera
    // teórica entre el findUnique y el create, aceptable acá: esta
    // sincronización corre bajo demanda (un botón, un negocio a la vez),
    // no en alta concurrencia — y si dos corridas chocaran, el índice
    // único de la base sigue siendo la garantía real de que nunca se crea
    // un duplicado (el segundo create fallaría por constraint, no
    // silenciosamente).
    const existing = await prisma.lead.findUnique({
      where: { businessId_source_sourceRef: { businessId, source: SOURCE, sourceRef: appointment.id } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: appointment.customerName,
        phone: appointment.customerPhone,
        status: "new",
        source: SOURCE,
        sourceRef: appointment.id,
      },
    });

    await createActivity(businessId, {
      relatedType: "lead",
      relatedId: lead.id,
      type: "note",
      body: `Lead creado desde una reserva en Nexo (${appointment.serviceName}, ${appointment.date} ${appointment.startTime})`,
    });
    created++;
  }

  return { created, skipped, total: appointments.length };
}

const INQUIRY_SOURCE = "nexo_inquiry";

// Mismo contrato que syncLeadsFromNexoAppointments (idempotente por
// (businessId, source, sourceRef), create-only, nunca pisa un Lead ya
// tocado). Diferencia: una consulta SÍ trae email, y el texto de la
// consulta va como nota (Activity), no como columna nueva del Lead.
export async function syncLeadsFromNexoInquiries(businessId: string): Promise<SyncLeadsResult> {
  const inquiries = await listNexoInquiries(businessId);

  let created = 0;
  let skipped = 0;

  for (const inquiry of inquiries) {
    const existing = await prisma.lead.findUnique({
      where: { businessId_source_sourceRef: { businessId, source: INQUIRY_SOURCE, sourceRef: inquiry.id } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: inquiry.customerName,
        email: inquiry.customerEmail,
        phone: inquiry.customerWhatsapp,
        status: "new",
        source: INQUIRY_SOURCE,
        sourceRef: inquiry.id,
      },
    });

    await createActivity(businessId, {
      relatedType: "lead",
      relatedId: lead.id,
      type: "note",
      body: `Consulta desde el sitio web (Nexo): ${inquiry.message}`,
    });
    created++;
  }

  return { created, skipped, total: inquiries.length };
}

export interface SyncNexoResult extends SyncLeadsResult {
  appointments: SyncLeadsResult;
  inquiries: SyncLeadsResult;
}

// Única acción de usuario ("Sincronizar con Nexo"): corre ambas fuentes y
// devuelve los totales combinados más el desglose.
export async function syncLeadsFromNexo(businessId: string): Promise<SyncNexoResult> {
  const appointments = await syncLeadsFromNexoAppointments(businessId);
  const inquiries = await syncLeadsFromNexoInquiries(businessId);
  return {
    created: appointments.created + inquiries.created,
    skipped: appointments.skipped + inquiries.skipped,
    total: appointments.total + inquiries.total,
    appointments,
    inquiries,
  };
}
