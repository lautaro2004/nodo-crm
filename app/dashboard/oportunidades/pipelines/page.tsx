import { resolveWorkspaceContext } from "@/lib/workspace";
import { listPipelines } from "@/modules/pipelines/service";
import { PageHeader } from "@/components/ui/primitives";
import { PipelineManager } from "@/components/pipelines/pipeline-manager";

export default async function PipelinesPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const pipelines = await listPipelines(ctx.businessId);

  return (
    <div>
      <PageHeader title="Pipelines" description="Un Workspace puede tener más de un pipeline — no hay un único flujo global." />
      <PipelineManager pipelines={pipelines} />
    </div>
  );
}
