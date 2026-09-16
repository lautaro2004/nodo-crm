import { prisma } from "@/lib/prisma";
import { INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";

const DEFAULT_MODULES = ["companies", "contacts", "leads", "opportunities", "tasks"];

// La existencia de esta fila ES la señal de "este Business usa CRM" — ver
// prisma/schema.prisma (comentario en el modelo Workspace). Idempotente,
// mismo criterio que ensureBusinessMembership.
export async function ensureWorkspace(businessId: string) {
  const existing = await prisma.workspace.findUnique({ where: { businessId } });
  if (existing) return existing;

  return prisma.workspace.create({
    data: {
      businessId,
      activeModules: DEFAULT_MODULES,
      onboardingStep: "industry",
    },
  });
}

export async function getWorkspace(businessId: string) {
  return prisma.workspace.findUnique({ where: { businessId } });
}

// Para el layout del dashboard: nombre/logo vienen de public.Business (no
// se duplican en Workspace — ver crm-fase3-core.md, "Workspace: nombre y
// logo").
export async function getWorkspaceWithBusiness(businessId: string) {
  return prisma.workspace.findUnique({
    where: { businessId },
    include: { business: true },
  });
}

// Aplica un template de rubro: setea activeModules + industryTemplate, y
// siembra Pipeline/PipelineStage/StatusDefinition por default — SOLO si el
// Workspace todavía no tiene ninguno propio (no pisa configuración que el
// dueño ya haya tocado a mano). Cierra el onboarding (onboardingStep: null).
export async function applyIndustryTemplate(businessId: string, industry: IndustryKey) {
  const template = INDUSTRY_TEMPLATES[industry];

  await prisma.workspace.update({
    where: { businessId },
    data: { industryTemplate: industry, activeModules: template.activeModules, onboardingStep: null },
  });

  const existingPipelines = await prisma.pipeline.count({ where: { businessId } });
  if (existingPipelines === 0) {
    const pipeline = await prisma.pipeline.create({
      data: { businessId, name: "Ventas", isDefault: true },
    });
    await prisma.pipelineStage.createMany({
      data: template.pipelineStages.map((s, order) => ({
        pipelineId: pipeline.id,
        key: s.key,
        label: s.label,
        order,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      })),
    });
    await prisma.workspace.update({ where: { businessId }, data: { defaultPipelineId: pipeline.id } });
  }

  const existingLeadStatuses = await prisma.statusDefinition.count({ where: { businessId, entityType: "lead" } });
  if (existingLeadStatuses === 0) {
    await prisma.statusDefinition.createMany({
      data: template.leadStatuses.map((s, order) => ({
        businessId,
        entityType: "lead",
        key: s.key,
        label: s.label,
        color: s.color,
        order,
        isDefault: order === 0,
      })),
    });
  }

  const existingCompanyStatuses = await prisma.statusDefinition.count({ where: { businessId, entityType: "company" } });
  if (existingCompanyStatuses === 0) {
    await prisma.statusDefinition.createMany({
      data: template.companyStatuses.map((s, order) => ({
        businessId,
        entityType: "company",
        key: s.key,
        label: s.label,
        color: s.color,
        order,
        isDefault: order === 0,
      })),
    });
  }

  return getWorkspace(businessId);
}

export async function updateWorkspaceModules(businessId: string, activeModules: string[]) {
  return prisma.workspace.update({ where: { businessId }, data: { activeModules } });
}
