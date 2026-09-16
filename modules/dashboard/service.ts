import { prisma } from "@/lib/prisma";

// Estados que se consideran "cerrados" para un Lead a los fines del
// dashboard — Lead.status es texto libre configurable por Workspace (ver
// StatusDefinition), así que esto es una heurística razonable, no una
// regla de dominio dura: cualquier status que no sea uno de estos cuenta
// como "abierto".
const CLOSED_LEAD_STATUSES = ["disqualified", "converted", "lost"];

export interface DashboardMetrics {
  companiesCount: number;
  contactsCount: number;
  openLeadsCount: number;
  openOpportunitiesCount: number;
  pendingTasksCount: number;
  leadsFromNexoCount: number;
}

export async function getDashboardMetrics(businessId: string): Promise<DashboardMetrics> {
  const [companiesCount, contactsCount, openLeadsCount, openOpportunitiesCount, pendingTasksCount, leadsFromNexoCount] =
    await Promise.all([
      prisma.company.count({ where: { businessId, status: { not: "archived" } } }),
      prisma.contact.count({ where: { businessId } }),
      prisma.lead.count({ where: { businessId, status: { notIn: CLOSED_LEAD_STATUSES } } }),
      prisma.opportunity.count({ where: { businessId, status: "open" } }),
      prisma.task.count({ where: { businessId, status: "pending" } }),
      // Fase 4 — dato real (COUNT sobre Lead.source), no una métrica de
      // marketing inventada.
      prisma.lead.count({ where: { businessId, source: "nexo_appointment" } }),
    ]);

  return { companiesCount, contactsCount, openLeadsCount, openOpportunitiesCount, pendingTasksCount, leadsFromNexoCount };
}

export async function getRecentActivity(businessId: string, limit = 10) {
  return prisma.activity.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
