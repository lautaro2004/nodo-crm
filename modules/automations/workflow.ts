import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isStandardEntityType, standardModuleInfo, type FieldMeta } from "@/lib/entities";
import { moduleIdFromEntityType } from "@/lib/custom-modules";
import { formatCustomValue } from "@/lib/custom-fields";
import { createActivity, type RelatedType } from "@/modules/activities/service";
import { createNotification } from "@/modules/notifications/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { getFieldMap, getModuleDescriptor, loadSnapshot, type FieldValue, type RecordSnapshot } from "@/modules/entities/registry";
import { currentChain, runInChain } from "@/modules/automations/context";
import { evaluateGroup, isEmptyValue, type Values } from "@/modules/automations/conditions";
import { MAX_CHAIN_DEPTH, workflowConfigSchema, type WorkflowAction, type WorkflowConfig } from "@/modules/automations/workflow-config";
import { resolveRelatedIds } from "@/modules/automations/related";

// Motor genérico de automatizaciones (reglas "workflow") para TODOS los
// módulos, estándar y personalizados.
//
// Punto de entrada único: `trackChange`, que envuelve el alta/edición/baja
// en los servicios de dominio (modules/leads/service.ts, …,
// modules/custom-modules/records.ts). Por eso aplica igual desde la UI, el
// Kanban, la API, la importación o las integraciones — nunca depende del
// navegador.
//
// Garantías (mismas que el motor clásico de modules/automations/engine.ts):
// - Validaciones "antes de guardar": se evalúan sobre el estado PROPUESTO;
//   si exigen campos o impiden el cambio, se lanza
//   AutomationRequirementError y NO se escribe nada.
// - Sin duplicados: cada evento tiene un id; (ruleId, dedupeKey) único en
//   AutomationRun → una regla nunca corre dos veces para el mismo evento.
// - Sin ciclos ni recursión infinita: ver modules/automations/context.ts.
// - Una acción que falla queda registrada (AutomationRun.details) y nunca
//   rompe la operación que disparó la regla.

export interface RequirementField {
  key: string;
  label: string;
  type: string;
  options: { value: string; label: string }[];
  target?: string;
  multiple?: boolean;
  /** Dónde va el valor en el body del request que se reintenta. */
  bodyPath: string[];
}

export interface AutomationRequirement {
  ruleName: string;
  message: string;
  blocked: boolean;
  fields: RequirementField[];
}

/** El cambio no se guardó: una automatización exige campos o lo impide. */
export class AutomationRequirementError extends Error {
  constructor(public requirement: AutomationRequirement) {
    super("automation_required");
  }
}

type Rule = { id: string; name: string; businessId: string; config: Prisma.JsonValue; createdAt: Date };

async function activeRules(businessId: string, entityType: string): Promise<(Rule & { parsed: WorkflowConfig })[]> {
  const rules = await prisma.automationRule.findMany({
    where: { businessId, type: "workflow", module: entityType, enabled: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, businessId: true, config: true, createdAt: true },
  });
  const out: (Rule & { parsed: WorkflowConfig })[] = [];
  for (const r of rules) {
    const parsed = workflowConfigSchema.safeParse(r.config);
    if (parsed.success) out.push({ ...r, parsed: parsed.data });
  }
  return out;
}

function changed(before: Values | null, after: Values, field: string) {
  if (!before) return !isEmptyValue(after[field]);
  const a = JSON.stringify([after[field] ?? null].flat().map((x) => (x ?? "").toString().trim()).sort());
  const b = JSON.stringify([before[field] ?? null].flat().map((x) => (x ?? "").toString().trim()).sort());
  return a !== b;
}

function triggerMatches(config: WorkflowConfig, kind: "create" | "update" | "delete", before: Values | null, after: Values) {
  const ev = config.trigger.event;
  const ok =
    (kind === "create" && (ev === "created" || ev === "created_or_updated")) ||
    (kind === "update" && (ev === "updated" || ev === "created_or_updated")) ||
    (kind === "delete" && ev === "deleted");
  if (!ok) return false;
  if (config.trigger.field && kind !== "delete") return changed(kind === "create" ? null : before, after, config.trigger.field);
  return true;
}

/** Dónde va cada campo en el body del request (para el reintento desde la UI). */
function bodyPathFor(entityType: string, key: string): string[] {
  if (key.startsWith("cf:")) return [moduleIdFromEntityType(entityType) ? "values" : "customValues", key.slice(3)];
  return [key];
}

// ── Antes de guardar ────────────────────────────────────────────────────

async function runBeforeSave(
  businessId: string,
  entityType: string,
  rules: (Rule & { parsed: WorkflowConfig })[],
  before: RecordSnapshot | null,
  proposed: Record<string, FieldValue>,
  kind: "create" | "update"
) {
  const validators = rules.filter((r) => r.parsed.trigger.event === "before_save");
  if (validators.length === 0) return;
  const fields = await getFieldMap(businessId, entityType);
  const prev = before?.values ?? null;
  const merged: Values = { ...(prev ?? {}), ...normalizeProposed(proposed, fields) };

  for (const rule of validators) {
    const cfg = rule.parsed;
    if (cfg.trigger.field && !changed(kind === "create" ? null : prev, merged, cfg.trigger.field)) continue;
    if (!evaluateGroup(cfg.conditions, fields, merged, kind === "create" ? null : prev)) continue;

    const missing = new Set<string>();
    let blockedMessage: string | null = null;
    let message: string | null = null;
    for (const action of cfg.actions) {
      if (action.type === "block") blockedMessage = action.message;
      if (action.type === "require_fields") {
        for (const f of action.fields) if (fields.has(f) && isEmptyValue(merged[f])) missing.add(f);
        if (action.message) message = action.message;
      }
    }
    if (!blockedMessage && missing.size === 0) continue;

    const descriptor = missing.size ? await getModuleDescriptor(businessId, entityType) : null;
    const withOptions = new Map((descriptor?.fields ?? []).map((f) => [f.key, f]));
    const reqFields: RequirementField[] = Array.from(missing).map((key) => {
      const meta = (withOptions.get(key) ?? fields.get(key)) as FieldMeta;
      return { key, label: meta.label, type: meta.type, options: meta.options ?? [], target: meta.target, multiple: meta.multiple, bodyPath: bodyPathFor(entityType, key) };
    });
    const labels = reqFields.map((f) => `«${f.label}»`).join(", ");
    const requirement: AutomationRequirement = {
      ruleName: rule.name,
      blocked: !!blockedMessage,
      message: blockedMessage ?? message ?? `Para guardar este cambio completá ${labels}.`,
      fields: blockedMessage ? [] : reqFields,
    };
    await logRun(rule, `blocked:${randomUUID()}`, entityType, before?.id ?? "nuevo", "blocked", requirement.message, "before_save", 0);
    throw new AutomationRequirementError(requirement);
  }
}

/** Listas (multiselect/relación) como arreglo, igual que en los snapshots. */
function normalizeProposed(proposed: Record<string, FieldValue>, fields: Map<string, FieldMeta>): Values {
  const out: Values = {};
  for (const [key, v] of Object.entries(proposed)) {
    const meta = fields.get(key);
    if (!meta) continue;
    if ((meta.type === "relation" || meta.type === "multiselect") && typeof v === "string") {
      out[key] = v.split(meta.type === "multiselect" ? /[,;]/ : ",").map((p) => p.trim()).filter(Boolean);
    } else out[key] = v;
  }
  return out;
}

// ── Registro de ejecuciones ─────────────────────────────────────────────

async function logRun(rule: Rule, dedupeKey: string, entityType: string, entityId: string, status: string, message: string, trigger: string, depth: number, details?: unknown) {
  try {
    return await prisma.automationRun.create({
      data: {
        businessId: rule.businessId,
        ruleId: rule.id,
        dedupeKey,
        entityType,
        entityId,
        status,
        message: message.slice(0, 500),
        trigger,
        depth,
        ...(details ? { details: details as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  }
}

// ── Acciones ────────────────────────────────────────────────────────────

interface ActionResult {
  type: string;
  status: "success" | "skipped" | "error";
  message: string;
}

function recordHref(entityType: string, snapshot: RecordSnapshot, moduleKey: string | null) {
  const std = standardModuleInfo(entityType);
  if (std) return `${std.href}/${snapshot.id}`;
  return moduleKey ? `/dashboard/m/${moduleKey}/${snapshot.id}` : null;
}

function renderTemplate(text: string, snapshot: RecordSnapshot, moduleLabel: string) {
  return text.replace(/\{\{\s*(nombre|modulo)\s*\}\}/gi, (_, k: string) => (k.toLowerCase() === "nombre" ? snapshot.title : moduleLabel));
}

function valueForAction(action: { value?: string | null; valueFrom?: string | null }, snapshot: RecordSnapshot): FieldValue {
  if (action.valueFrom) return snapshot.values[action.valueFrom] ?? null;
  return action.value?.trim() ? action.value.trim() : null;
}

async function executeAction(
  businessId: string,
  entityType: string,
  rule: Rule,
  action: WorkflowAction,
  snapshot: RecordSnapshot,
  ctx: { actorUserId: string | null; kind: "create" | "update" | "delete"; moduleLabel: string; moduleKey: string | null }
): Promise<ActionResult> {
  const { writeFields } = await import("@/modules/entities/writer");
  const members = await listWorkspaceMembers(businessId);
  const isMember = (u: string | null | undefined) => !!u && members.some((m) => m.userId === u);
  const href = recordHref(entityType, snapshot, ctx.moduleKey);
  const who = (u: string) => {
    const m = members.find((x) => x.userId === u);
    return m ? m.name || m.email : u;
  };

  switch (action.type) {
    case "set_field": {
      await writeFields(businessId, entityType, snapshot.id, { [action.field]: valueForAction(action, snapshot) }, ctx.actorUserId);
      return { type: action.type, status: "success", message: "Campo actualizado." };
    }
    case "assign_owner": {
      if (action.onlyIfUnassigned && snapshot.ownerId) return { type: action.type, status: "skipped", message: "Ya tenía responsable." };
      const candidates = action.userIds.filter(isMember);
      if (candidates.length === 0) return { type: action.type, status: "skipped", message: "Ninguno de los usuarios sigue siendo miembro." };
      let userId = candidates[0];
      if (action.mode === "round_robin") {
        const updated = await prisma.automationRule.update({ where: { id: rule.id }, data: { cursor: { increment: 1 } }, select: { cursor: true } });
        userId = candidates[(updated.cursor - 1) % candidates.length];
      }
      if (snapshot.ownerId === userId) return { type: action.type, status: "skipped", message: "Ya era el responsable." };
      await writeFields(businessId, entityType, snapshot.id, { ownerId: userId }, ctx.actorUserId);
      await createNotification(businessId, userId, { type: "record_assigned", title: `Te asignaron: ${snapshot.title}`, body: `${ctx.moduleLabel} — regla “${rule.name}”.`, resourceHref: href });
      return { type: action.type, status: "success", message: `Asignado a ${who(userId)}.` };
    }
    case "create_task": {
      const { createTask } = await import("@/modules/tasks/service");
      const assignee = action.assignTo === "record_owner" ? snapshot.ownerId : action.assignTo === "actor" ? ctx.actorUserId : (action.userId ?? null);
      const link: Record<string, string> = {};
      if (entityType === "lead") link.leadId = snapshot.id;
      if (entityType === "contact") link.contactId = snapshot.id;
      if (entityType === "company") link.companyId = snapshot.id;
      if (entityType === "opportunity") link.opportunityId = snapshot.id;
      const dueAt = new Date(Date.now() + action.dueInDays * 86_400_000).toISOString();
      const title = renderTemplate(action.title, snapshot, ctx.moduleLabel);
      const description = isStandardEntityType(entityType) && entityType !== "task" ? null : `Creada por la regla “${rule.name}” desde ${ctx.moduleLabel}: ${snapshot.title}${href ? ` (${href})` : ""}`;
      await createTask(businessId, { title, description, priority: action.priority, dueAt, ownerId: isMember(assignee) ? assignee : null, ...(ctx.kind === "delete" ? {} : link) }, null);
      return { type: action.type, status: "success", message: `Tarea “${title}” creada.` };
    }
    case "notify": {
      let recipients: string[] = [];
      if (action.recipients === "owner") recipients = snapshot.ownerId ? [snapshot.ownerId] : [];
      if (action.recipients === "actor") recipients = ctx.actorUserId ? [ctx.actorUserId] : [];
      if (action.recipients === "admins") recipients = members.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.userId);
      if (action.recipients === "users") recipients = action.userIds ?? [];
      recipients = Array.from(new Set(recipients.filter(isMember)));
      if (recipients.length === 0) return { type: action.type, status: "skipped", message: "No hay destinatarios (sin responsable o ya no son miembros)." };
      for (const userId of recipients) {
        await createNotification(businessId, userId, {
          type: "automation",
          title: renderTemplate(action.title, snapshot, ctx.moduleLabel),
          body: renderTemplate(action.message?.trim() || `${ctx.moduleLabel}: ${snapshot.title}`, snapshot, ctx.moduleLabel),
          resourceHref: ctx.kind === "delete" ? null : href,
        });
      }
      return { type: action.type, status: "success", message: `Notificado a ${recipients.length} ${recipients.length === 1 ? "persona" : "personas"}.` };
    }
    case "add_note": {
      await createActivity(businessId, { relatedType: entityType as RelatedType, relatedId: snapshot.id, type: "note", body: `${renderTemplate(action.body, snapshot, ctx.moduleLabel)} (regla “${rule.name}”)` });
      return { type: action.type, status: "success", message: "Nota agregada." };
    }
    case "update_related": {
      const related = await resolveRelatedIds(businessId, entityType, snapshot.id, action.via);
      if (!related) return { type: action.type, status: "error", message: "La relación configurada ya no existe." };
      if (related.ids.length === 0) return { type: action.type, status: "skipped", message: "No hay registros relacionados." };
      const value = valueForAction(action, snapshot);
      let ok = 0;
      const errors: string[] = [];
      for (const id of related.ids) {
        try {
          await writeFields(businessId, related.target, id, { [action.field]: value }, ctx.actorUserId);
          ok++;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : "error");
        }
      }
      if (errors.length && ok === 0) return { type: action.type, status: "error", message: `No se pudo actualizar ningún relacionado (${errors[0]}).` };
      return { type: action.type, status: "success", message: `${ok} ${ok === 1 ? "relacionado actualizado" : "relacionados actualizados"}${errors.length ? `, ${errors.length} con error` : ""}.` };
    }
    case "send_email":
      return sendEmailAction(businessId, entityType, rule, action, snapshot, ctx, members);
    default:
      return { type: action.type, status: "skipped", message: "Acción no aplicable a este disparador." };
  }
}

// ── Acción "Enviar un email" ───────────────────────────────────────────────
// Reutiliza el envío del módulo de email (proveedor y remitente del negocio,
// plantillas y variables). Nunca manda un correo con variables sin resolver
// ni a una dirección que no sale de la configuración de la regla o del propio
// registro.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ENTITY_TYPES = new Set(["contact", "lead", "opportunity"]);

async function sendEmailAction(
  businessId: string,
  entityType: string,
  rule: Rule,
  action: Extract<WorkflowAction, { type: "send_email" }>,
  snapshot: RecordSnapshot,
  ctx: { actorUserId: string | null; kind: "create" | "update" | "delete"; moduleLabel: string; moduleKey: string | null },
  members: { userId: string; email: string }[]
): Promise<ActionResult> {
  const { getTemplate } = await import("@/modules/email/templates");
  const { renderTemplate: renderEmail, escapeHtml, resolveEntityContext } = await import("@/modules/email/variables");
  const { sendAutomationEmail } = await import("@/modules/email/send");
  const type = action.type;

  const template = await getTemplate(businessId, action.templateId);
  if (!template) return { type, status: "error", message: "La plantilla de email ya no existe." };

  // Valores de las variables de plantilla ({{contact.name}}, …) y, para
  // contactos/leads/oportunidades, el destinatario "del registro". En un
  // borrado el registro ya no está: se usa lo que quedó en el snapshot.
  const entityCtx =
    EMAIL_ENTITY_TYPES.has(entityType) && ctx.kind !== "delete"
      ? await resolveEntityContext(businessId, entityType as "contact" | "lead" | "opportunity", snapshot.id)
      : null;

  let to: string | null = null;
  if (action.to === "record") {
    const fromSnapshot = snapshot.values.email;
    to = entityCtx?.recipient?.email ?? (typeof fromSnapshot === "string" ? fromSnapshot : null);
  } else if (action.to === "field") {
    const v = action.field ? snapshot.values[action.field] : null;
    to = typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
  } else if (action.to === "owner") {
    to = members.find((m) => m.userId === snapshot.ownerId)?.email ?? null;
  } else {
    to = action.address ?? null;
  }
  to = to?.trim() || null;
  if (!to) return { type, status: "skipped", message: "El registro no tiene a quién enviarle el email." };
  if (!EMAIL_RE.test(to)) return { type, status: "skipped", message: `“${to}” no es un email válido.` };

  // {{nombre}} y {{modulo}} (variables de automatización) + las de plantilla.
  const local = (text: string, html: boolean) =>
    text.replace(/\{\{\s*(nombre|modulo)\s*\}\}/gi, (_, k: string) => {
      const value = k.toLowerCase() === "nombre" ? snapshot.title : ctx.moduleLabel;
      return html ? escapeHtml(value) : value;
    });
  const values = entityCtx?.values ?? {};
  const subject = renderEmail(local(template.subject, false), values);
  const body = renderEmail(local(template.bodyHtml, true), values, { html: true });
  const unresolved = [...new Set([...subject.unresolved, ...body.unresolved])];
  if (unresolved.length) {
    return { type, status: "error", message: `La plantilla usa variables que este registro no tiene: ${unresolved.join(", ")}. No se envió.` };
  }

  try {
    const result = await sendAutomationEmail(businessId, {
      to,
      subject: subject.output,
      html: body.output,
      ruleName: rule.name,
      related: ctx.kind === "delete" ? null : { type: entityType, id: snapshot.id },
    });
    if (result.status === "limit_reached") {
      return { type, status: "skipped", message: "Se alcanzó el tope diario de emails automáticos del negocio." };
    }
    if (result.status === "failed") return { type, status: "error", message: `No se pudo enviar a ${result.to}: ${result.error}.` };
    return { type, status: "success", message: result.status === "simulated" ? `Simulado (modo prueba) a ${result.to}.` : `Enviado a ${result.to}.` };
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "email_not_configured") return { type, status: "error", message: "El email del negocio no está configurado (Configuración → Email)." };
    if (code === "provider_unavailable") return { type, status: "error", message: "El proveedor de email no está disponible." };
    throw err;
  }
}

async function dispatchEvent(
  businessId: string,
  entityType: string,
  rules: (Rule & { parsed: WorkflowConfig })[],
  event: { id: string; kind: "create" | "update" | "delete"; before: RecordSnapshot | null; after: RecordSnapshot | null; actorUserId: string | null }
) {
  const chain = currentChain();
  const depth = chain?.depth ?? 0;
  const snapshot = (event.after ?? event.before)!;
  const fields = await getFieldMap(businessId, entityType);
  const after = (event.after ?? event.before)!.values;
  const before = event.kind === "create" ? null : (event.before?.values ?? null);
  const triggerName = event.kind === "create" ? "created" : event.kind === "update" ? "updated" : "deleted";
  let meta: { label: string; key: string | null } | null = null;

  for (const rule of rules) {
    const cfg = rule.parsed;
    if (cfg.trigger.event === "before_save") continue;
    if (!triggerMatches(cfg, event.kind, before, after)) continue;
    if (!evaluateGroup(cfg.conditions, fields, after, before)) continue;
    if (chain?.ruleIds.has(rule.id)) {
      await logRun(rule, `${event.id}:cycle`, entityType, snapshot.id, "skipped", "Omitida: ya corrió en esta cadena de automatizaciones (evita ciclos).", triggerName, depth);
      continue;
    }
    const run = await logRun(rule, event.id, entityType, snapshot.id, "running", "En curso…", triggerName, depth);
    if (!run) continue; // otro proceso ya la ejecutó para este evento

    if (!meta) {
      const moduleId = moduleIdFromEntityType(entityType);
      const mod = moduleId ? await prisma.customModule.findFirst({ where: { id: moduleId, businessId }, select: { labelSingular: true, key: true } }) : null;
      meta = { label: mod?.labelSingular ?? standardModuleInfo(entityType)?.singular ?? entityType, key: mod?.key ?? null };
    }

    const results: ActionResult[] = [];
    const nextChain = { depth: depth + 1, ruleIds: new Set([...(chain?.ruleIds ?? []), rule.id]), actorUserId: event.actorUserId };
    await runInChain(nextChain, async () => {
      for (const action of cfg.actions) {
        try {
          results.push(await executeAction(businessId, entityType, rule, action, snapshot, { actorUserId: event.actorUserId, kind: event.kind, moduleLabel: meta!.label, moduleKey: meta!.key }));
        } catch (err) {
          const code = err instanceof Error ? err.message : "error";
          const message = err instanceof AutomationRequirementError ? err.requirement.message : code;
          results.push({ type: action.type, status: "error", message });
          if (cfg.stopOnError) break;
        }
      }
    });
    const failed = results.filter((r) => r.status === "error").length;
    const status = failed ? "error" : results.every((r) => r.status === "skipped") ? "skipped" : "success";
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status, message: results.map((r) => r.message).join(" · ").slice(0, 500) || "Sin acciones.", details: results as unknown as Prisma.InputJsonValue },
    });
  }
}

/**
 * Envuelve una escritura de dominio con el motor de automatizaciones.
 * - `proposed`: los campos que se van a escribir (clave de campo → valor
 *   normalizado), para las validaciones "antes de guardar".
 * - `write`: la escritura real; `resultId` dice qué registro quedó.
 * Si el módulo no tiene reglas activas, solo ejecuta `write` (camino
 * rápido: una consulta liviana).
 */
export async function trackChange<T>(
  input: {
    businessId: string;
    entityType: string;
    kind: "create" | "update" | "delete";
    recordId?: string | null;
    proposed?: Record<string, FieldValue>;
    actorUserId?: string | null;
  },
  write: () => Promise<T>,
  resultId: (result: T) => string | null | undefined
): Promise<T> {
  const chain = currentChain();
  if (chain && chain.depth > MAX_CHAIN_DEPTH) return write();
  const rules = await activeRules(input.businessId, input.entityType);
  if (rules.length === 0) return write();

  const before = input.recordId ? await loadSnapshot(input.businessId, input.entityType, input.recordId) : null;
  if (input.kind !== "create" && !before) return write();
  // Las validaciones son para cambios hechos por personas, no por otras automatizaciones.
  if (input.kind !== "delete" && !chain) await runBeforeSave(input.businessId, input.entityType, rules, before, input.proposed ?? {}, input.kind);

  const result = await write();
  const id = resultId(result);
  if (!id) return result;
  try {
    const after = input.kind === "delete" ? null : await loadSnapshot(input.businessId, input.entityType, id);
    if (input.kind !== "delete" && !after) return result;
    const actorUserId = input.actorUserId ?? chain?.actorUserId ?? null;
    await dispatchEvent(input.businessId, input.entityType, rules, { id: randomUUID(), kind: input.kind, before, after, actorUserId });
  } catch (err) {
    console.error("[automations] workflow", input.entityType, id, err);
  }
  return result;
}

/** Evento de alta para escrituras masivas que no pasan por los servicios (importación, sincronizaciones). */
export async function emitCreated(businessId: string, entityType: string, id: string, actorUserId: string | null = null) {
  try {
    const rules = await activeRules(businessId, entityType);
    if (rules.length === 0) return;
    const after = await loadSnapshot(businessId, entityType, id);
    if (after) await dispatchEvent(businessId, entityType, rules, { id: randomUUID(), kind: "create", before: null, after, actorUserId });
  } catch (err) {
    console.error("[automations] emitCreated", entityType, id, err);
  }
}

// ── Utilidades para los servicios ───────────────────────────────────────

const toFieldValue = (v: unknown): FieldValue => {
  if (v === undefined) return null;
  if (v === null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(String);
  return String(v);
};

/**
 * Estado propuesto a partir del input de un servicio: los campos estándar
 * usan el mismo nombre que la columna; los personalizados "cf:<id>".
 */
export function proposedFrom(standard: Record<string, unknown>, customValues?: Record<string, string | null> | null): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const [k, v] of Object.entries(standard)) {
    if (v === undefined || k === "customValues" || k === "values") continue;
    out[k] = toFieldValue(v);
  }
  for (const [id, raw] of Object.entries(customValues ?? {})) out[`cf:${id}`] = (raw ?? "").trim() || null;
  return out;
}

/** Para mostrar un valor en mensajes. */
export function displayValue(meta: FieldMeta | undefined, v: FieldValue) {
  if (v === null) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return meta ? formatCustomValue(meta.type, v) || v : v;
}
