import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listPipelines } from "@/modules/pipelines/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { PageHeader, Button, EmptyState } from "@/components/ui/primitives";
import { OpportunityBoard } from "@/components/opportunities/opportunity-board";

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ pipelineId?: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const pipelines = await listPipelines(ctx.businessId);
  const { pipelineId: requestedPipelineId } = await searchParams;
  const pipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];

  const opportunities = pipeline
    ? await listOpportunities(ctx.businessId, { pipelineId: pipeline.id, status: "open" })
    : [];

  return (
    <div>
      <PageHeader
        title="Oportunidades"
        description={pipeline ? `Pipeline: ${pipeline.name}` : undefined}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/oportunidades/pipelines">
              <Button variant="secondary">Gestionar pipelines</Button>
            </Link>
            {pipeline && (
              <Link href="/dashboard/oportunidades/nueva">
                <Button>Nueva oportunidad</Button>
              </Link>
            )}
          </div>
        }
      />

      {pipelines.length > 1 && (
        <div className="mb-4 flex gap-2">
          {pipelines.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/oportunidades?pipelineId=${p.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                p.id === pipeline?.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {!pipeline ? (
        <EmptyState
          title="Todavía no hay ningún pipeline"
          description="Creá uno para empezar a registrar oportunidades."
          action={
            <Link href="/dashboard/oportunidades/pipelines">
              <Button>Crear pipeline</Button>
            </Link>
          }
        />
      ) : (
        <OpportunityBoard
          stages={pipeline.stages}
          opportunities={opportunities.map((o) => ({
            id: o.id,
            title: o.title,
            amount: o.amount,
            stageId: o.stageId,
            company: o.company,
          }))}
        />
      )}
    </div>
  );
}
