import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";
import { createNotification } from "@/modules/notifications/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { getClosedLeadStatusKeys } from "@/modules/status-definitions/service";
import { parseConfig, type AssignLeadConfig } from "@/modules/automations/config";

// Motor de automatizaciones.
//
// Garantías:
// - Persistencia: cada ejecución queda en AutomationRun (éxito, omitida o
//   error, con mensaje) — visible en Configuración → Automatizaciones.
// - Sin duplicados: (ruleId, dedupeKey) es único en la base. Se "reclama"
//   la ejecución insertando el run ANTES de actuar; si ya existe (otro
//   request, reintento del cron), no se ejecuta de nuevo.
// - Revalidación: justo antes de actuar se vuelve a leer el lead y se
//   comprueban las condiciones (sigue sin responsable, sigue en ese estado,
//   el usuario sigue siendo miembro…); las escrituras usan updateMany con
//   la condición en el WHERE para no pisar un cambio concurrente.
// - Nunca rompe la operación que la disparó: un error queda registrado en
//   el run y se traga acá.
// - Se ejecuta en el servicio de dominio (modules/leads/service.ts), así
//   que aplica igual desde la UI, el Kanban, la importación o la API.

type RunStatus = "success" | "skipped" | "error";

async function claimRun(rule: { id: string; businessId: string }, dedupeKey: string, entityId: string) {
  try {
    return await prisma.automationRun.create({
      data: { businessId: rule.businessId, ruleId: rule.id, dedupeKey, entityType: "lead", entityId, status: "running" },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

async function finishRun(runId: string, status: RunStatus, message: string) {
  await prisma.automationRun.update({ where: { id: runId }, data: { status, message: message.slice(0, 500) } });
}

async function activeMemberIds(businessId: string) {
  return new Map((await listWorkspaceMembers(businessId)).map((m) => [m.userId, m]));
}

const leadHref = (id: string) => `/dashboard/leads/${id}`;

// ── Asignación automática ───────────────────────────────────────────────

export async function runLeadCreatedAutomations(businessId: string, leadId: string) {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { businessId, type: "assign_lead", enabled: true },
      orderBy: { createdAt: "asc" },
    });
    if (rules.length === 0) return;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, name: true, ownerId: true, source: true } });
    if (!lead || lead.ownerId) return;

    for (const rule of rules) {
      const config = parseConfig("assign_lead", rule.config);
      if (!config) continue;
      if (config.sources.length > 0 && !config.sources.includes(lead.source ?? "manual")) continue;

      // La primera regla que aplica decide; las demás no compiten.
      const run = await claimRun(rule, `lead:${lead.id}:created`, lead.id);
      if (!run) return;
      try {
        const result = await assignByRule(businessId, rule, config, lead);
        await finishRun(run.id, result.status, result.message);
      } catch (err) {
        await finishRun(run.id, "error", err instanceof Error ? err.message : "error");
      }
      return;
    }
  } catch (err) {
    console.error("[automations] runLeadCreatedAutomations", err);
  }
}

async function assignByRule(
  businessId: string,
  rule: { id: string; name: string },
  config: AssignLeadConfig,
  lead: { id: string; name: string }
): Promise<{ status: RunStatus; message: string }> {
  const members = await activeMemberIds(businessId);
  const candidates = config.userIds.filter((u) => members.has(u));
  if (candidates.length === 0) return { status: "skipped", message: "Ninguno de los responsables de la regla sigue siendo miembro del espacio." };

  let userId = candidates[0];
  if (config.mode === "round_robin") {
    // Incremento atómico: dos leads simultáneos nunca reciben el mismo turno.
    const updated = await prisma.automationRule.update({ where: { id: rule.id }, data: { cursor: { increment: 1 } }, select: { cursor: true } });
    userId = candidates[(updated.cursor - 1) % candidates.length];
  }

  const claimed = await prisma.lead.updateMany({ where: { id: lead.id, businessId, ownerId: null }, data: { ownerId: userId } });
  if (claimed.count === 0) return { status: "skipped", message: "El lead ya tenía responsable al momento de asignar." };

  const member = members.get(userId)!;
  const who = member.name || member.email;
  await createActivity(businessId, { relatedType: "lead", relatedId: lead.id, type: "assigned", body: `Asignado automáticamente a ${who} (regla “${rule.name}”)` });
  await createNotification(businessId, userId, {
    type: "lead_assigned",
    title: "Te asignaron un lead",
    body: `${lead.name} — asignado por la regla “${rule.name}”.`,
    resourceHref: leadHref(lead.id),
  });
  return { status: "success", message: `Asignado a ${who}.` };
}

// ── Reglas por cambio de estado ─────────────────────────────────────────

export async function runLeadStatusAutomations(
  businessId: string,
  event: { leadId: string; from: string; to: string; eventId: string }
) {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { businessId, type: "lead_status_change", enabled: true },
      orderBy: { createdAt: "asc" },
    });
    for (const rule of rules) {
      const config = parseConfig("lead_status_change", rule.config);
      if (!config || config.toStatus !== event.to) continue;
      if (config.fromStatus && config.fromStatus !== event.from) continue;

      const run = await claimRun(rule, `lead:${event.leadId}:status:${event.eventId}`, event.leadId);
      if (!run) continue;
      try {
        const lead = await prisma.lead.findFirst({ where: { id: event.leadId, businessId }, select: { id: true, name: true, ownerId: true, status: true } });
        if (!lead || lead.status !== event.to) {
          await finishRun(run.id, "skipped", "El lead ya no está en ese estado.");
          continue;
        }
        const done: string[] = [];
        const members = await activeMemberIds(businessId);
        let ownerId = lead.ownerId;

        if (config.assignTo) {
          if (!members.has(config.assignTo)) {
            done.push("asignación omitida (el usuario ya no es miembro)");
          } else if (config.onlyIfUnassigned && ownerId) {
            done.push("asignación omitida (ya tenía responsable)");
          } else if (ownerId !== config.assignTo) {
            const where = config.onlyIfUnassigned ? { id: lead.id, businessId, ownerId: null } : { id: lead.id, businessId };
            const r = await prisma.lead.updateMany({ where, data: { ownerId: config.assignTo } });
            if (r.count > 0) {
              ownerId = config.assignTo;
              const m = members.get(config.assignTo)!;
              await createActivity(businessId, { relatedType: "lead", relatedId: lead.id, type: "assigned", body: `Asignado automáticamente a ${m.name || m.email} (regla “${rule.name}”)` });
              await createNotification(businessId, config.assignTo, { type: "lead_assigned", title: "Te asignaron un lead", body: `${lead.name} — regla “${rule.name}”.`, resourceHref: leadHref(lead.id) });
              done.push(`asignado a ${m.name || m.email}`);
            }
          }
        }

        if (config.createTask) {
          const dueAt = new Date(Date.now() + config.createTask.dueInDays * 86_400_000);
          const task = await prisma.task.create({
            data: { businessId, title: config.createTask.title, leadId: lead.id, ownerId: ownerId && members.has(ownerId) ? ownerId : null, dueAt },
          });
          await createActivity(businessId, { relatedType: "task", relatedId: task.id, type: "note", body: `Tarea creada por la regla “${rule.name}”` });
          done.push(`tarea “${config.createTask.title}” creada`);
        }

        if (config.notifyOwner) {
          if (ownerId && members.has(ownerId)) {
            await createNotification(businessId, ownerId, { type: "lead_status", title: `${lead.name}: cambio de estado`, body: `Pasó a “${event.to}”.`, resourceHref: leadHref(lead.id) });
            done.push("responsable notificado");
          } else {
            done.push("notificación omitida (sin responsable)");
          }
        }

        await finishRun(run.id, "success", done.join("; ") || "Sin acciones aplicables.");
      } catch (err) {
        await finishRun(run.id, "error", err instanceof Error ? err.message : "error");
      }
    }
  } catch (err) {
    console.error("[automations] runLeadStatusAutomations", err);
  }
}

// ── Leads sin atención (cron) ───────────────────────────────────────────

// Al activar una regla no se alerta por todo el histórico: solo leads
// creados desde una semana antes de crear la regla.
const UNATTENDED_LOOKBACK_MS = 7 * 86_400_000;
const UNATTENDED_BATCH = 200;

export async function processUnattendedLeads(now: Date = new Date()) {
  const rules = await prisma.automationRule.findMany({ where: { type: "lead_unattended", enabled: true } });
  let notified = 0;
  let skipped = 0;
  let errors = 0;

  for (const rule of rules) {
    const config = parseConfig("lead_unattended", rule.config);
    if (!config) continue;
    try {
      const closed = await getClosedLeadStatusKeys(rule.businessId);
      const leads = await prisma.lead.findMany({
        where: {
          businessId: rule.businessId,
          status: { notIn: closed },
          // "Atención efectiva" = seguimiento real registrado por una
          // persona (ver isFollowUp en modules/activities/service.ts).
          // Abrir la ficha NO cuenta.
          lastFollowUpAt: null,
          createdAt: { lt: new Date(now.getTime() - config.hours * 3_600_000), gte: new Date(rule.createdAt.getTime() - UNATTENDED_LOOKBACK_MS) },
        },
        select: { id: true, name: true, ownerId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: UNATTENDED_BATCH,
      });
      if (leads.length === 0) continue;
      const members = await listWorkspaceMembers(rule.businessId);
      const admins = members.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.userId);

      for (const lead of leads) {
        const run = await claimRun(rule, `lead:${lead.id}:unattended`, lead.id);
        if (!run) {
          skipped++;
          continue;
        }
        // Revalidación puntual (pudo registrarse un seguimiento entre la
        // consulta y ahora).
        const fresh = await prisma.lead.findFirst({ where: { id: lead.id, businessId: rule.businessId }, select: { lastFollowUpAt: true, status: true, ownerId: true } });
        if (!fresh || fresh.lastFollowUpAt || closed.includes(fresh.status)) {
          await finishRun(run.id, "skipped", "El lead ya tuvo seguimiento o se cerró.");
          skipped++;
          continue;
        }
        const ownerIsMember = !!fresh.ownerId && members.some((m) => m.userId === fresh.ownerId);
        const recipients = ownerIsMember ? [fresh.ownerId!] : admins;
        for (const userId of recipients) {
          await createNotification(rule.businessId, userId, {
            type: "lead_unattended",
            title: "Lead sin atención",
            body: `${lead.name} lleva más de ${config.hours} h sin seguimiento${ownerIsMember ? "" : " y sin responsable"}.`,
            resourceHref: leadHref(lead.id),
          });
        }
        await finishRun(run.id, "success", `Notificado a ${recipients.length} ${recipients.length === 1 ? "persona" : "personas"}.`);
        notified++;
      }
    } catch (err) {
      errors++;
      console.error("[automations] processUnattendedLeads", rule.id, err);
    }
  }
  return { rules: rules.length, notified, skipped, errors };
}
