import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";
import { getProvider, type OutgoingEmail, type SendResult } from "./providers";
import { getEmailSettings } from "./settings";
import { getTemplate } from "./templates";
import { findVariables, renderTemplate, resolveEntityContext, SAMPLE_VALUES, type EmailEntityType } from "./variables";

async function deliver(businessId: string, to: string, subject: string, html: string): Promise<SendResult> {
  const { settings, status } = await getEmailSettings(businessId);
  if (!settings || status === "not_configured") throw new Error("email_not_configured");
  if (status === "provider_unavailable") throw new Error("provider_unavailable");
  const provider = getProvider(settings.provider);
  if (!provider) throw new Error("provider_unavailable");
  const message: OutgoingEmail = { from: { email: settings.fromEmail!, name: settings.fromName }, to, subject, html };
  return provider.send(message);
}

// Vista previa con los datos reales de la entidad: mismos valores y mismo
// escape que el envío. Devuelve además el destinatario y lo que falta.
export async function previewEntityEmail(
  businessId: string,
  entityType: EmailEntityType,
  entityId: string,
  input: { templateId?: string; subject?: string; bodyHtml?: string }
) {
  const ctx = await resolveEntityContext(businessId, entityType, entityId);
  if (!ctx) throw new Error("entity_not_found");

  let subject = input.subject;
  let bodyHtml = input.bodyHtml;
  if (input.templateId) {
    const t = await getTemplate(businessId, input.templateId);
    if (!t) throw new Error("template_not_found");
    subject = t.subject;
    bodyHtml = t.bodyHtml;
  }
  const s = renderTemplate(subject ?? "", ctx.values);
  const b = renderTemplate(bodyHtml ?? "", ctx.values, { html: true });
  return {
    subject: s.output,
    bodyHtml: b.output,
    recipient: ctx.recipient,
    unresolved: [...new Set([...s.unresolved, ...b.unresolved])],
  };
}

const STATUS_LABEL = { sent: "Enviado", simulated: "Simulado (sin entrega real)", failed: "Falló" } as const;

// Envía el correo (asunto/cuerpo YA editados por el usuario) y registra
// Activity type "email" en la entidad, tanto si sale bien como si falla.
export async function sendEntityEmail(
  businessId: string,
  actorUserId: string,
  entityType: EmailEntityType,
  entityId: string,
  input: { subject: string; bodyHtml: string }
) {
  const ctx = await resolveEntityContext(businessId, entityType, entityId);
  if (!ctx) throw new Error("entity_not_found");
  if (!ctx.recipient) throw new Error("recipient_missing");

  // Cualquier variable que siga en el texto es una que no se pudo
  // resolver (o desconocida): se rechaza en vez de mandar "{{x}}" al cliente.
  if (findVariables(input.subject).length || findVariables(input.bodyHtml).length) throw new Error("unresolved_variables");

  const result = await deliver(businessId, ctx.recipient.email, input.subject, input.bodyHtml);
  const status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";

  await createActivity(businessId, {
    relatedType: entityType,
    relatedId: entityId,
    type: "email",
    ownerId: actorUserId,
    body: [
      `Para: ${ctx.recipient.email}`,
      `Asunto: ${input.subject}`,
      `Estado: ${STATUS_LABEL[status]}${result.ok ? "" : ` (${result.error})`}`,
    ].join("\n"),
  });

  return result.ok ? { status, to: ctx.recipient.email } : { status, to: ctx.recipient.email, error: result.error };
}

// Envío de prueba de una plantilla con datos de ejemplo, SIEMPRE al email
// del usuario que lo pide. No genera Activity (no hay entidad).
export async function sendTestEmail(businessId: string, actorUserId: string, templateId: string) {
  const template = await getTemplate(businessId, templateId);
  if (!template) throw new Error("template_not_found");
  const user = await prisma.user.findUnique({ where: { id: actorUserId }, select: { email: true } });
  if (!user) throw new Error("user_not_found");

  const subject = `[Prueba] ${renderTemplate(template.subject, SAMPLE_VALUES).output}`;
  const html = renderTemplate(template.bodyHtml, SAMPLE_VALUES, { html: true }).output;
  const result = await deliver(businessId, user.email, subject, html);
  return result.ok ? { status: result.simulated ? "simulated" : "sent", to: user.email } : { status: "failed" as const, to: user.email, error: result.error };
}

// ── Envío desde automatizaciones ──────────────────────────────────────────

// Tope de emails automáticos por negocio en 24 h: una regla mal armada (por
// ejemplo "al modificar" sin condiciones, sobre una importación de miles de
// filas) no debe poder mandar cientos de correos. Los envíos manuales no
// cuentan.
export const AUTOMATION_EMAIL_DAILY_LIMIT = 200;
const AUTOMATION_MARK = "Automatización:";

export type AutomationEmailResult =
  | { status: "sent" | "simulated"; to: string }
  | { status: "failed"; to: string; error: string }
  | { status: "limit_reached" };

/**
 * Envía un email ya renderizado a pedido de una automatización y deja la
 * Activity en el registro (si el módulo tiene historial). Mismo proveedor y
 * remitente que el envío manual (Resend o sandbox, ver providers.ts). Lanza
 * email_not_configured / provider_unavailable igual que el envío manual.
 */
export async function sendAutomationEmail(
  businessId: string,
  input: { to: string; subject: string; html: string; ruleName: string; related: { type: string; id: string } | null }
): Promise<AutomationEmailResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentToday = await prisma.activity.count({
    where: { businessId, type: "email", body: { startsWith: AUTOMATION_MARK }, createdAt: { gte: since } },
  });
  if (sentToday >= AUTOMATION_EMAIL_DAILY_LIMIT) return { status: "limit_reached" };

  const result = await deliver(businessId, input.to, input.subject, input.html);
  const status = result.ok ? (result.simulated ? "simulated" : "sent") : "failed";

  if (input.related) {
    await createActivity(businessId, {
      relatedType: input.related.type as Parameters<typeof createActivity>[1]["relatedType"],
      relatedId: input.related.id,
      type: "email",
      ownerId: null,
      body: [
        `${AUTOMATION_MARK} ${input.ruleName}`,
        `Para: ${input.to}`,
        `Asunto: ${input.subject}`,
        `Estado: ${STATUS_LABEL[status]}${result.ok ? "" : ` (${result.error})`}`,
      ].join("\n"),
    });
  }

  if (!result.ok) return { status: "failed", to: input.to, error: result.error };
  return { status: result.simulated ? "simulated" : "sent", to: input.to };
}
