import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { listPipelines } from "@/modules/pipelines/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { STALLED_DAYS } from "@/modules/dashboard/service";
import { PageHeader, Button, EmptyState, ViewToggle } from "@/components/ui/primitives";
import { PlusIcon, TrendingUpIcon } from "@/components/ui/icons";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { OpportunityBoard } from "@/components/opportunities/opportunity-board";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "updated", label: "Última actualización" },
  { value: "amount", label: "Mayor valor" },
  { value: "title", label: "Título (A–Z)" },
];

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineId?: string; display?: string; q?: string; status?: string; ownerId?: string; sort?: string; stalled?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [pipelines, moduleLabel] = await Promise.all([listPipelines(ctx.businessId), getModuleLabel(ctx.businessId, "opportunity")]);
  const { pipelineId: requestedPipelineId, display, q, status, ownerId, sort, stalled } = await searchParams;
  const pipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const isKanban = display !== "list"; // default histórico: Kanban primero, no rompe bookmarks existentes
  const stalledBefore = stalled === "1" ? new Date(Date.now() - STALLED_DAYS * 86_400_000) : undefined;

  const [opportunities, members] = await Promise.all([
    pipeline
      ? listOpportunities(ctx.businessId, {
          pipelineId: pipeline.id,
          search: q,
          ownerId,
          sort,
          stalledBefore,
          // Kanban necesita ver TODOS los status (una tarjeta movida a la
          // columna "Ganado" tiene que seguir apareciendo ahí) — el filtro
          // de status solo aplica en la vista Lista.
          status: isKanban ? undefined : status,
        })
      : Promise.resolve([]),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));
  const params = new URLSearchParams(
    Object.entries({ pipelineId: pipeline?.id, q, status, ownerId, sort, stalled }).filter((e): e is [string, string] => !!e[1])
  );
  const hasFilters = !!(q || ownerId || stalled || (!isKanban && status));
  const singular = moduleLabel.labelSingular.toLowerCase();
  const plural = moduleLabel.labelPlural.toLowerCase();
  const clearHref = `/dashboard/oportunidades?${new URLSearchParams({ pipelineId: pipeline?.id ?? "", ...(display ? { display } : {}) })}`;

  return (
    <div>
      <PageHeader
        title={moduleLabel.labelPlural}
        description={pipeline ? `${opportunities.length} en ${pipeline.name}` : undefined}
        actions={
          <>
            <Link href="/dashboard/oportunidades/pipelines">
              <Button variant="secondary">Gestionar pipelines</Button>
            </Link>
            {pipeline && (
              <Link href="/dashboard/oportunidades/nueva">
                <Button>
                  <PlusIcon className="h-4 w-4" />
                  Nueva {singular}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {pipelines.length > 1 && (
        <nav aria-label="Pipelines" className="mb-4 flex flex-wrap gap-1.5">
          {pipelines.map((p) => {
            const pipelineParams = new URLSearchParams(params);
            pipelineParams.set("pipelineId", p.id);
            if (display) pipelineParams.set("display", display);
            const active = p.id === pipeline?.id;
            return (
              <Link
                key={p.id}
                href={`/dashboard/oportunidades?${pipelineParams.toString()}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
                  active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
        </nav>
      )}

      {!pipeline ? (
        <EmptyState
          icon={<TrendingUpIcon className="h-5 w-5" />}
          title="Todavía no hay ningún pipeline"
          description={`Creá uno para empezar a registrar ${plural}.`}
          action={
            <Link href="/dashboard/oportunidades/pipelines">
              <Button>Crear pipeline</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-x-3">
            <div className="min-w-[16rem] flex-1">
              <SearchFilterBar
                key={`${params.toString()}|${display ?? ""}`}
                searchPlaceholder="Buscar por título…"
                statusOptions={isKanban ? undefined : Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                ownerOptions={members.length > 1 ? members.map((m) => ({ value: m.userId, label: m.name || m.email })) : undefined}
                sortOptions={isKanban ? undefined : SORT_OPTIONS}
              />
            </div>
            <div className="mb-4">
              <ViewToggle basePath="/dashboard/oportunidades" params={params} value={isKanban ? "kanban" : "list"} defaultView="kanban" />
            </div>
          </div>

          {stalled === "1" && (
            <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                Abiertas sin movimiento hace más de {STALLED_DAYS} días
              </span>
              <Link href={clearHref} className="text-xs font-medium text-brand-700 hover:underline">
                Quitar filtro
              </Link>
            </p>
          )}

          {opportunities.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="Nada coincide con estos filtros"
                description="Probá con otra búsqueda o quitá los filtros."
                action={
                  <Link href={clearHref}>
                    <Button variant="secondary">Quitar filtros</Button>
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<TrendingUpIcon className="h-5 w-5" />}
                title={`Todavía no hay ${plural} en este pipeline`}
                description={`Creá la primera, o convertí un lead calificado en ${singular} desde su ficha.`}
                action={
                  <Link href="/dashboard/oportunidades/nueva">
                    <Button>
                      <PlusIcon className="h-4 w-4" />
                      Nueva {singular}
                    </Button>
                  </Link>
                }
              />
            )
          ) : isKanban ? (
            <OpportunityBoard
              stalledDays={STALLED_DAYS}
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
                updatedAt: o.updatedAt,
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
                updatedAt: o.updatedAt,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
