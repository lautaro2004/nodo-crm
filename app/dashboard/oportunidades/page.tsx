import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { listPipelines } from "@/modules/pipelines/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { parseOpportunityFilters, STALLED_DAYS } from "@/modules/opportunities/filters";
import { getToolbarData, memberNames } from "@/modules/views/toolbar-data";
import { PageHeader, Button, EmptyState } from "@/components/ui/primitives";
import { PlusIcon, TrendingUpIcon } from "@/components/ui/icons";
import { OpportunityBoard } from "@/components/opportunities/opportunity-board";
import { OpportunityTable } from "@/components/opportunities/opportunity-table";
import { ListToolbar } from "@/components/views/list-toolbar";
import { OPPORTUNITY_COLUMNS, OPPORTUNITY_DEFAULT_COLUMNS, customColumns, resolveColumns } from "@/lib/views/columns";
import { loadCustomCells } from "@/modules/custom-fields/columns";
import { OPPORTUNITY_PRESETS } from "@/lib/views/presets";

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "updated", label: "Última actualización" },
  { value: "amount", label: "Mayor valor" },
  { value: "title", label: "Título (A–Z)" },
];

type SP = Record<string, string | string[] | undefined>;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const sp = await searchParams;
  const [pipelines, moduleLabel, toolbar] = await Promise.all([
    listPipelines(ctx.businessId),
    getModuleLabel(ctx.businessId, "opportunity"),
    getToolbarData(ctx, "opportunity"),
  ]);
  const requestedPipelineId = typeof sp.pipelineId === "string" ? sp.pipelineId : undefined;
  const pipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];
  // Default histórico: Kanban primero (no rompe bookmarks existentes).
  const display = sp.display === "list" ? "list" : "kanban";

  // Mismos filtros en Lista y Kanban (alternar vistas no los pierde).
  const filters = { ...parseOpportunityFilters(sp, ctx.userId), pipelineId: pipeline?.id };
  const opportunities = pipeline ? await listOpportunities(ctx.businessId, filters) : [];
  const names = memberNames(toolbar.members);
  const allColumns = [...OPPORTUNITY_COLUMNS, ...customColumns(toolbar.customFieldDefs)];
  const columns = resolveColumns(allColumns, OPPORTUNITY_DEFAULT_COLUMNS, typeof sp.cols === "string" ? sp.cols : undefined);
  const custom =
    display === "list" ? await loadCustomCells(ctx.businessId, toolbar.customFieldDefs, columns, opportunities.map((o) => o.id)) : undefined;
  const hasFilters = Object.keys(sp).some((k) => !["display", "cols", "sort", "view", "pipelineId"].includes(k));
  const singular = moduleLabel.labelSingular.toLowerCase();
  const plural = moduleLabel.labelPlural.toLowerCase();
  const total = opportunities.reduce((n, o) => n + (o.status === "open" ? (o.amount ?? 0) : 0), 0);

  const rows = opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    amount: o.amount,
    status: o.status,
    stageId: o.stageId,
    stage: o.stage,
    company: o.company,
    contact: o.contact,
    ownerName: o.ownerId ? (names.get(o.ownerId) ?? null) : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    closedAt: o.closedAt,
  }));

  return (
    <div>
      <PageHeader
        title={moduleLabel.labelPlural}
        description={
          pipeline
            ? `${opportunities.length} en ${pipeline.name}${total > 0 ? ` · $${total.toLocaleString("es-AR")} abiertos` : ""}${hasFilters ? " (filtrado)" : ""}`
            : undefined
        }
        actions={
          <>
            {hasRole(ctx.role, "admin") && (
              <Link href="/dashboard/oportunidades/pipelines">
                <Button variant="secondary">Gestionar pipelines</Button>
              </Link>
            )}
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
            const next = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
            next.set("pipelineId", p.id);
            next.delete("view");
            const active = p.id === pipeline?.id;
            return (
              <Link
                key={p.id}
                href={`/dashboard/oportunidades?${next.toString()}`}
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
          <ListToolbar
            entity="opportunity"
            searchPlaceholder="Buscar por título…"
            filters={toolbar.filters}
            columns={allColumns}
            defaultColumns={OPPORTUNITY_DEFAULT_COLUMNS}
            sortOptions={SORT_OPTIONS}
            presets={OPPORTUNITY_PRESETS}
            savedViews={toolbar.savedViews}
            canShare={toolbar.canShare}
            display={display}
            defaultDisplay="kanban"
            exportPath="/api/export/opportunities"
          />

          {opportunities.length === 0 ? (
            hasFilters ? (
              <EmptyState title="Nada coincide con estos filtros" description="Probá con otra búsqueda o quitá algún filtro." />
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
          ) : display === "kanban" ? (
            <OpportunityBoard stalledDays={STALLED_DAYS} stages={pipeline.stages} opportunities={rows} />
          ) : (
            <OpportunityTable opportunities={rows} columns={columns} custom={custom} />
          )}
        </>
      )}
    </div>
  );
}
