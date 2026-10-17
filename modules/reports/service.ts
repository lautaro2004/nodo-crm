import { prisma } from "@/lib/prisma";
import { getDay, getList, getParam, type SearchParamsLike } from "@/lib/filters/params";
import { buildLeadWhere } from "@/modules/leads/filters";
import { buildOpportunityWhere } from "@/modules/opportunities/filters";
import { getClosedLeadStatusKeys, getRejectionLeadStatusKeys } from "@/modules/status-definitions/service";

// Informes. Definiciones (las mismas que muestra la página, en "Cómo se
// calcula"):
// - Cohorte de leads = leads CREADOS en el período (+ filtros de responsable,
//   origen y estado). Todas las métricas de leads se calculan sobre esa
//   cohorte, con su estado ACTUAL.
// - Rechazado = estado marcado como rechazo (StatusDefinition.isRejection).
// - Convertido = convertedAt no nulo.
// - Sin seguimiento = abierto (ni convertido ni rechazado) y sin ninguna
//   actividad real registrada por una persona (lastFollowUpAt nulo).
// - Oportunidades ganadas/perdidas = cerradas (closedAt) dentro del período.
// - Oportunidades por etapa = abiertas hoy (foto actual, no depende del período).
// Los filtros reutilizan buildLeadWhere/buildOpportunityWhere: misma lógica
// que las listas y la exportación.

export interface ReportFilters {
  from: Date;
  to: Date;
  ownerId?: string;
  source?: string[];
  status?: string[];
  pipelineId?: string;
}

const DAY = 86_400_000;

export function parseReportFilters(sp: SearchParamsLike, currentUserId?: string, now: Date = new Date()): ReportFilters & { fromKey: string; toKey: string } {
  const rawPreset = getParam(sp, "range");
  const preset = rawPreset && ["7", "30", "90", "365", "month"].includes(rawPreset) ? rawPreset : undefined;
  let from = getDay(sp, "from");
  let to = getDay(sp, "to");
  const todayKey = toKey(now);
  const today = new Date(`${todayKey}T00:00:00-03:00`);
  if (!from || !to || preset) {
    const days = preset === "7" ? 7 : preset === "90" ? 90 : preset === "365" ? 365 : 30;
    if (preset === "month") {
      to = today;
      from = new Date(`${todayKey.slice(0, 8)}01T00:00:00-03:00`);
    } else {
      to = today;
      from = new Date(today.getTime() - (days - 1) * DAY);
    }
  }
  if (from > to) [from, to] = [to, from];
  const owner = getParam(sp, "ownerId");
  return {
    from,
    to,
    fromKey: toKey(from),
    toKey: toKey(to),
    ownerId: owner === "me" ? currentUserId : owner || undefined,
    source: getList(sp, "source"),
    status: getList(sp, "status"),
    pipelineId: getParam(sp, "pipelineId") || undefined,
  };
}

/** YYYY-MM-DD en hora de Argentina. */
export function toKey(d: Date) {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export async function getLeadReport(businessId: string, f: ReportFilters) {
  const where = await buildLeadWhere(businessId, {
    from: f.from,
    to: f.to,
    dateField: "created",
    ownerId: f.ownerId,
    source: f.source,
    status: f.status,
  });
  const [leads, rejectionKeys, closedKeys] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: { id: true, name: true, status: true, statusReason: true, source: true, convertedAt: true, lastFollowUpAt: true, createdAt: true, ownerId: true },
      orderBy: { createdAt: "asc" },
    }),
    getRejectionLeadStatusKeys(businessId),
    getClosedLeadStatusKeys(businessId),
  ]);

  const rejected = leads.filter((l) => rejectionKeys.includes(l.status));
  const converted = leads.filter((l) => l.convertedAt);
  const noFollowUp = leads.filter((l) => !closedKeys.includes(l.status) && !l.lastFollowUpAt);

  const reasons = countBy(rejected, (l) => l.statusReason?.trim() || "Sin motivo registrado");

  const bySource = new Map<string, { source: string; received: number; converted: number; rejected: number }>();
  for (const l of leads) {
    const key = l.source ?? "manual";
    const row = bySource.get(key) ?? { source: key, received: 0, converted: 0, rejected: 0 };
    row.received++;
    if (l.convertedAt) row.converted++;
    if (rejectionKeys.includes(l.status)) row.rejected++;
    bySource.set(key, row);
  }

  return {
    received: leads.length,
    rejected: rejected.length,
    converted: converted.length,
    noFollowUp: noFollowUp.length,
    reasons,
    bySource: Array.from(bySource.values()).sort((a, b) => b.received - a.received),
    series: timeSeries(leads.map((l) => l.createdAt), f.from, f.to),
    noFollowUpLeads: noFollowUp.map((l) => ({ id: l.id, name: l.name, createdAt: l.createdAt, ownerId: l.ownerId, status: l.status })),
    rows: leads,
  };
}

export async function getOpportunityReport(businessId: string, f: ReportFilters) {
  const pipeline = f.pipelineId
    ? await prisma.pipeline.findFirst({ where: { id: f.pipelineId, businessId }, include: { stages: { orderBy: { order: "asc" } } } })
    : await defaultPipeline(businessId);

  const [openWhere, closedWhere] = await Promise.all([
    buildOpportunityWhere(businessId, { pipelineId: pipeline?.id, status: "open", ownerId: f.ownerId }),
    buildOpportunityWhere(businessId, { pipelineId: pipeline?.id, status: ["won", "lost"], ownerId: f.ownerId, from: f.from, to: f.to, dateField: "closed" }),
  ]);
  const [open, closed] = await Promise.all([
    prisma.opportunity.findMany({ where: openWhere, select: { stageId: true, amount: true } }),
    prisma.opportunity.findMany({ where: closedWhere, select: { id: true, title: true, status: true, amount: true, closedAt: true, ownerId: true, stage: { select: { label: true } } } }),
  ]);

  const byStage = (pipeline?.stages ?? [])
    .filter((s) => !s.isWon && !s.isLost)
    .map((s) => {
      const items = open.filter((o) => o.stageId === s.id);
      return { id: s.id, label: s.label, color: s.color, isWon: s.isWon, isLost: s.isLost, count: items.length, amount: sum(items) };
    });
  const won = closed.filter((o) => o.status === "won");
  const lost = closed.filter((o) => o.status === "lost");

  return {
    pipelineName: pipeline?.name ?? null,
    byStage,
    won: { count: won.length, amount: sum(won) },
    lost: { count: lost.length, amount: sum(lost) },
    winRate: won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null,
    closedSeries: {
      won: timeSeries(won.map((o) => o.closedAt!), f.from, f.to),
      lost: timeSeries(lost.map((o) => o.closedAt!), f.from, f.to),
    },
    closedRows: closed,
  };
}

async function defaultPipeline(businessId: string) {
  const ws = await prisma.workspace.findUnique({ where: { businessId }, select: { defaultPipelineId: true } });
  return prisma.pipeline.findFirst({
    where: { businessId, ...(ws?.defaultPipelineId ? { id: ws.defaultPipelineId } : {}) },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

function sum(items: { amount: number | null }[]) {
  return items.reduce((n, o) => n + (o.amount ?? 0), 0);
}

export function countBy<T>(items: T[], key: (t: T) => string) {
  const map = new Map<string, number>();
  for (const i of items) map.set(key(i), (map.get(key(i)) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Serie temporal: por día si el período es de hasta 31 días, si no por
// semana (lunes). Incluye los buckets vacíos para no "saltar" en el gráfico.
export function timeSeries(dates: Date[], from: Date, to: Date) {
  const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  const weekly = days > 31;
  const bucketKey = (d: Date) => {
    const k = toKey(d);
    if (!weekly) return k;
    const local = new Date(`${k}T00:00:00Z`);
    const dow = (local.getUTCDay() + 6) % 7;
    return new Date(local.getTime() - dow * DAY).toISOString().slice(0, 10);
  };
  const buckets = new Map<string, number>();
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) buckets.set(bucketKey(new Date(t)), 0);
  for (const d of dates) {
    const k = bucketKey(d);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + 1);
  }
  return { unit: weekly ? ("week" as const) : ("day" as const), points: Array.from(buckets.entries()).map(([key, count]) => ({ key, count })) };
}
