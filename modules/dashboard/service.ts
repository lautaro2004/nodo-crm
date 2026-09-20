import { prisma } from "@/lib/prisma";

// Estados que se consideran "cerrados" para un Lead a los fines del
// dashboard — Lead.status es texto libre configurable por Workspace (ver
// StatusDefinition), así que esto es una heurística razonable, no una
// regla de dominio dura: cualquier status que no sea uno de estos cuenta
// como "abierto".
const CLOSED_LEAD_STATUSES = ["disqualified", "converted", "lost"];
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
  ] = await Promise.all([
    prisma.company.count({ where: { businessId, status: { not: "archived" } } }),
    prisma.contact.count({ where: { businessId } }),
    prisma.lead.count({ where: { businessId, status: { notIn: CLOSED_LEAD_STATUSES } } }),
    prisma.opportunity.count({ where: { businessId, status: "open" } }),
    prisma.task.count({ where: { businessId, status: { in: OPEN_TASK_STATUSES } } }),
    prisma.task.count({ where: { businessId, status: { in: OPEN_TASK_STATUSES }, dueAt: { lt: startOfToday } } }),
    prisma.task.count({
      where: { businessId, status: { in: OPEN_TASK_STATUSES }, dueAt: { gte: startOfToday, lt: startOfTomorrow } },
    }),
    // Fase 4 — dato real (COUNT sobre Lead.source), no una métrica de
    // marketing inventada.
    prisma.lead.count({ where: { businessId, source: { in: ["nexo_appointment", "nexo_inquiry"] } } }),
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
  pipelineName: string;
  stages: { id: string; label: string; count: number }[];
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
  });
  const countByStage = new Map(counts.map((c) => [c.stageId, c._count._all]));

  return {
    pipelineName: pipeline.name,
    stages: pipeline.stages.map((s) => ({ id: s.id, label: s.label, count: countByStage.get(s.id) ?? 0 })),
  };
}
