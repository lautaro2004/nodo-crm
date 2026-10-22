import { prisma } from "@/lib/prisma";
import { listNexoAppointments } from "@/modules/nexo/appointments";
import { listNexoInquiries } from "@/modules/nexo/inquiries";
import { createActivity } from "@/modules/activities/service";
import { runLeadCreatedAutomations } from "@/modules/automations/engine";

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
export interface SyncOptions {
  // Ver listNexoAppointments: solo registros creados desde esta fecha.
  since?: Date;
}

export async function syncLeadsFromNexoAppointments(businessId: string, options: SyncOptions = {}): Promise<SyncLeadsResult> {
  const appointments = await listNexoAppointments(businessId, options);

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
    await runLeadCreatedAutomations(businessId, lead.id);
    created++;
  }

  return { created, skipped, total: appointments.length };
}

const INQUIRY_SOURCE = "nexo_inquiry";

// Mismo contrato que syncLeadsFromNexoAppointments (idempotente por
// (businessId, source, sourceRef), create-only, nunca pisa un Lead ya
// tocado). Diferencias: una consulta del formulario SÍ trae email (las de
// WhatsApp no), y el texto de la consulta va como nota (Activity), no como
// columna nueva del Lead. Las consultas web y las de WhatsApp comparten
// source "nexo_inquiry" (mismo registro de origen, nexo.Inquiry); el canal
// queda en la nota.
export async function syncLeadsFromNexoInquiries(businessId: string, options: SyncOptions = {}): Promise<SyncLeadsResult> {
  const inquiries = await listNexoInquiries(businessId, options);

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
      body:
        inquiry.source === "whatsapp"
          ? `Contacto nuevo por WhatsApp (Nexo): ${inquiry.message}`
          : `Consulta desde el sitio web (Nexo): ${inquiry.message}`,
    });
    await runLeadCreatedAutomations(businessId, lead.id);
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
export async function syncLeadsFromNexo(businessId: string, options: SyncOptions = {}): Promise<SyncNexoResult> {
  const appointments = await syncLeadsFromNexoAppointments(businessId, options);
  const inquiries = await syncLeadsFromNexoInquiries(businessId, options);
  return {
    created: appointments.created + inquiries.created,
    skipped: appointments.skipped + inquiries.skipped,
    total: appointments.total + inquiries.total,
    appointments,
    inquiries,
  };
}

// Ventana de la sincronización automática: el cron corre cada pocos minutos,
// así que mirar los últimos 7 días alcanza de sobra (cubre también días con
// el scheduler caído) sin recorrer todo el historial de cada negocio en cada
// corrida. Lo anterior a eso lo levanta el botón manual, que revisa todo.
export const AUTO_SYNC_WINDOW_DAYS = 7;

export interface SyncAllResult {
  workspaces: number;
  created: number;
  failed: number;
}

// Sincronización automática para TODOS los negocios con Nodo (los que tienen
// crm.Workspace). Un negocio que solo usa Nexo no tiene Workspace y nunca
// entra acá: sus consultas quedan solo en Nexo → Consultas. Un error en un
// negocio no corta a los demás.
export async function syncLeadsFromNexoForAllWorkspaces(now: Date = new Date()): Promise<SyncAllResult> {
  const since = new Date(now.getTime() - AUTO_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const workspaces = await prisma.workspace.findMany({ select: { businessId: true } });

  let created = 0;
  let failed = 0;
  for (const { businessId } of workspaces) {
    try {
      const result = await syncLeadsFromNexo(businessId, { since });
      created += result.created;
    } catch (error) {
      failed++;
      console.error(`[Nexo sync] Error sincronizando ${businessId}:`, error);
    }
  }

  return { workspaces: workspaces.length, created, failed };
}
