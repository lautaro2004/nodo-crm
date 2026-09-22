import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { listPipelines } from "@/modules/pipelines/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { PageHeader, Button, EmptyState, ViewToggle } from "@/components/ui/primitives";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { OpportunityBoard } from "@/components/opportunities/opportunity-board";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineId?: string; display?: string; q?: string; status?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [pipelines, moduleLabel] = await Promise.all([listPipelines(ctx.businessId), getModuleLabel(ctx.businessId, "opportunity")]);
  const { pipelineId: requestedPipelineId, display, q, status } = await searchParams;
  const pipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const isKanban = display !== "list"; // default histórico: Kanban primero, no rompe bookmarks existentes

  const [opportunities, members] = await Promise.all([
    pipeline
      ? listOpportunities(ctx.businessId, {
          pipelineId: pipeline.id,
          search: q,
          // Kanban necesita ver TODOS los status (una tarjeta movida a la
          // columna "Ganado" tiene que seguir apareciendo ahí) — el filtro
          // de status solo aplica en la vista Lista, donde tiene sentido
          // "buscar solo las abiertas/ganadas/perdidas".
          status: isKanban ? undefined : status,
        })
      : Promise.resolve([]),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));
  const params = new URLSearchParams(
    Object.entries({ pipelineId: pipeline?.id, q, status }).filter((e): e is [string, string] => !!e[1])
  );

  return (
    <div>
      <PageHeader
        title={moduleLabel.labelPlural}
        description={pipeline ? `Pipeline: ${pipeline.name}` : undefined}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/oportunidades/pipelines">
              <Button variant="secondary">Gestionar pipelines</Button>
            </Link>
            {pipeline && (
              <Link href="/dashboard/oportunidades/nueva">
                <Button>Nueva {moduleLabel.labelSingular.toLowerCase()}</Button>
              </Link>
            )}
          </div>
        }
      />

      {pipelines.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pipelines.map((p) => {
            const pipelineParams = new URLSearchParams(params);
            pipelineParams.set("pipelineId", p.id);
            if (display) pipelineParams.set("display", display);
            return (
              <Link
                key={p.id}
                href={`/dashboard/oportunidades?${pipelineParams.toString()}`}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  p.id === pipeline?.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
        </div>
      )}

      {!pipeline ? (
        <EmptyState
          title="Todavía no hay ningún pipeline"
          description={`Creá uno para empezar a registrar ${moduleLabel.labelPlural.toLowerCase()}.`}
          action={
            <Link href="/dashboard/oportunidades/pipelines">
              <Button>Crear pipeline</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1">
              {!isKanban && (
                <SearchFilterBar
                  searchPlaceholder="Buscar por título…"
                  statusOptions={Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                />
              )}
            </div>
            <ViewToggle basePath="/dashboard/oportunidades" params={params} value={isKanban ? "kanban" : "list"} />
          </div>

          {opportunities.length === 0 ? (
            <EmptyState
              title={`Todavía no hay ${moduleLabel.labelPlural.toLowerCase()}`}
              description="Creá la primera para empezar a trabajar este pipeline."
              action={
                <Link href="/dashboard/oportunidades/nueva">
                  <Button>Nueva {moduleLabel.labelSingular.toLowerCase()}</Button>
                </Link>
              }
            />
          ) : isKanban ? (
            <OpportunityBoard
              stages={pipeline.stages}
              opportunities={opportunities.map((o) => ({
                id: o.id,
                title: o.title,
                amount: o.amount,
                status: o.status,
                stageId: o.stageId,
                company: o.company,
                contact: o.contact,
                ownerName: o.ownerId ? (memberNameById.get(o.ownerId) ?? null) : null,
              }))}
            />
          ) : (
            <OpportunityTable
              opportunities={opportunities.map((o) => ({
                id: o.id,
                title: o.title,
                amount: o.amount,
                status: o.status,
                stage: o.stage,
                company: o.company,
                contact: o.contact,
                ownerName: o.ownerId ? (memberNameById.get(o.ownerId) ?? null) : null,
                createdAt: o.createdAt,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
