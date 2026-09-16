import { prisma } from "@/lib/prisma";

export async function createPipeline(businessId: string, data: { name: string; isDefault?: boolean }) {
  return prisma.pipeline.create({ data: { businessId, name: data.name, isDefault: data.isDefault ?? false } });
}

export async function listPipelines(businessId: string) {
  return prisma.pipeline.findMany({
    where: { businessId },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPipeline(businessId: string, id: string) {
  return prisma.pipeline.findFirst({
    where: { id, businessId },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function updatePipeline(businessId: string, id: string, data: { name?: string; isDefault?: boolean }) {
  const result = await prisma.pipeline.updateMany({ where: { id, businessId }, data });
  return result.count > 0;
}

// No se permite borrar un Pipeline con Opportunity activas — mismo
// criterio que Nexo con Subscription.plan (sin onDelete: Cascade a
// propósito): borrar el pipeline no debe arrastrar oportunidades reales.
export async function deletePipeline(businessId: string, id: string) {
  const opportunityCount = await prisma.opportunity.count({ where: { businessId, pipelineId: id } });
  if (opportunityCount > 0) throw new Error("pipeline_in_use");
  const result = await prisma.pipeline.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

async function assertPipelineBelongs(businessId: string, pipelineId: string) {
  const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, businessId }, select: { id: true } });
  if (!pipeline) throw new Error("pipeline_not_found");
}

export async function createStage(
  businessId: string,
  pipelineId: string,
  data: { key: string; label: string; order?: number; isWon?: boolean; isLost?: boolean }
) {
  await assertPipelineBelongs(businessId, pipelineId);
  const maxOrder = await prisma.pipelineStage.aggregate({ where: { pipelineId }, _max: { order: true } });
  return prisma.pipelineStage.create({
    data: {
      pipelineId,
      key: data.key,
      label: data.label,
      order: data.order ?? (maxOrder._max.order ?? -1) + 1,
      isWon: data.isWon ?? false,
      isLost: data.isLost ?? false,
    },
  });
}

export async function updateStage(
  businessId: string,
  pipelineId: string,
  stageId: string,
  data: { label?: string; order?: number; isWon?: boolean; isLost?: boolean }
) {
  await assertPipelineBelongs(businessId, pipelineId);
  const result = await prisma.pipelineStage.updateMany({ where: { id: stageId, pipelineId }, data });
  return result.count > 0;
}

export async function deleteStage(businessId: string, pipelineId: string, stageId: string) {
  await assertPipelineBelongs(businessId, pipelineId);
  const opportunityCount = await prisma.opportunity.count({ where: { businessId, stageId } });
  if (opportunityCount > 0) throw new Error("stage_in_use");
  const result = await prisma.pipelineStage.deleteMany({ where: { id: stageId, pipelineId } });
  return result.count > 0;
}

export async function reorderStages(businessId: string, pipelineId: string, stageIds: string[]) {
  await assertPipelineBelongs(businessId, pipelineId);
  await prisma.$transaction(
    stageIds.map((id, order) => prisma.pipelineStage.update({ where: { id }, data: { order } }))
  );
  return true;
}
