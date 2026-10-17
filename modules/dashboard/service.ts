import { prisma } from "@/lib/prisma";
import { stageColorKey } from "@/lib/status-colors";
import { getClosedLeadStatusKeys } from "@/modules/status-definitions/service";

import { STALLED_DAYS } from "@/modules/opportunities/filters";
export { STALLED_DAYS };

// Leads "abiertos" = no convertidos ni en un estado de rechazo
// (StatusDefinition.isRejection) — misma definición que filtros e informes.
const OPEN_TASK_STATUSES = ["todo", "in_progress"];

export interface DashboardMetrics {
  companiesCount: number;
  contactsCount: number;
  openLeadsCount: number;
  openOpportunitiesCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;
  dueTodayTasksCount: number;
  leadsFromNexoCount: number;
  stalledOpportunitiesCount: number;
}

export async function getDashboardMetrics(businessId: string): Promise<DashboardMetrics> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const [
    companiesCount,
    contactsCount,
    openLeadsCount,
    openOpportunitiesCount,
    pendingTasksCount,
    overdueTasksCount,
    dueTodayTasksCount,
    leadsFromNexoCount,
    stalledOpportunitiesCount,
  ] = await Promise.all([
    prisma.company.count({ where: { businessId, status: { not: "archived" } } }),
    prisma.contact.count({ where: { businessId } }),
    getClosedLeadStatusKeys(businessId).then((closed) => prisma.lead.count({ where: { businessId, status: { notIn: closed } } })),
    prisma.opportunity.count({ where: { businessId, status: "open" } }),
    prisma.task.count({ where: { businessId, status: { in: OPEN_TASK_STATUSES } } }),
    prisma.task.count({ where: { businessId, status: { in: OPEN_TASK_STATUSES }, dueAt: { lt: startOfToday } } }),
    prisma.task.count({
      where: { businessId, status: { in: OPEN_TASK_STATUSES }, dueAt: { gte: startOfToday, lt: startOfTomorrow } },
    }),
    // Fase 4 — dato real (COUNT sobre Lead.source), no una métrica de
    // marketing inventada.
    prisma.lead.count({ where: { businessId, source: { in: ["nexo_appointment", "nexo_inquiry"] } } }),
    prisma.opportunity.count({
      where: { businessId, status: "open", updatedAt: { lt: new Date(now.getTime() - STALLED_DAYS * 86_400_000) } },
    }),
  ]);

  return {
    companiesCount,
    contactsCount,
    openLeadsCount,
    openOpportunitiesCount,
    pendingTasksCount,
    overdueTasksCount,
    dueTodayTasksCount,
    leadsFromNexoCount,
    stalledOpportunitiesCount,
  };
}

export async function getRecentActivity(businessId: string, limit = 10) {
  return prisma.activity.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export interface PipelineSummary {
  pipelineId: string;
  pipelineName: string;
  stages: { id: string; label: string; count: number; amount: number; color: string }[];
}

// "Pipeline: oportunidades por etapa" del dashboard (fase de pulido UX) —
// SOLO el pipeline default del Workspace (o el primero si no hay default),
// para no convertir el inicio en un resumen de N pipelines. Cuenta
// únicamente oportunidades abiertas — ganadas/perdidas no aportan a "en
// qué está trabajando el equipo ahora".
export async function getPipelineSummary(businessId: string): Promise<PipelineSummary | null> {
  const workspace = await prisma.workspace.findUnique({ where: { businessId }, select: { defaultPipelineId: true } });

  const pipeline = await prisma.pipeline.findFirst({
    where: { businessId, ...(workspace?.defaultPipelineId ? { id: workspace.defaultPipelineId } : {}) },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  if (!pipeline) return null;

  const counts = await prisma.opportunity.groupBy({
    by: ["stageId"],
    where: { businessId, pipelineId: pipeline.id, status: "open" },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const byStage = new Map(counts.map((c) => [c.stageId, c]));

  return {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    stages: pipeline.stages
      .filter((s) => !s.isWon && !s.isLost)
      .map((s) => ({
        id: s.id,
        label: s.label,
        count: byStage.get(s.id)?._count._all ?? 0,
        amount: byStage.get(s.id)?._sum.amount ?? 0,
        color: stageColorKey(s),
      })),
  };
}
