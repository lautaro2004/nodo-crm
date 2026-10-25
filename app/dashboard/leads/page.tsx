import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listLeads } from "@/modules/leads/service";
import { parseLeadFilters } from "@/modules/leads/filters";
import { findStatusOption } from "@/modules/status-definitions/service";
import { getToolbarData, memberNames } from "@/modules/views/toolbar-data";
import { PageHeader, Button, EmptyState } from "@/components/ui/primitives";
import { PlusIcon, TargetIcon } from "@/components/ui/icons";
import { SyncNexoButton } from "@/components/leads/sync-nexo-button";
import { LeadBoard } from "@/components/leads/lead-board";
import { LeadTable } from "@/components/leads/lead-table";
import { ListToolbar } from "@/components/views/list-toolbar";
import { LEAD_COLUMNS, LEAD_DEFAULT_COLUMNS, customColumns, resolveColumns } from "@/lib/views/columns";
import { loadCustomCells } from "@/modules/custom-fields/columns";
import { LEAD_PRESETS } from "@/lib/views/presets";
import { can, resolveAccess, scopeWhere } from "@/modules/access/service";
import { getRestorableListParams } from "@/lib/views/remember";
import { ListPreferenceSync } from "@/components/views/list-preference-sync";
import { NoAccess } from "@/components/team/admin-only";
import { RECORD_NOUNS } from "@/lib/record-nouns";
import { RecordSelection, SelectAllBar } from "@/components/records/selection";

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "updated", label: "Última actualización" },
  { value: "followup", label: "Seguimiento más antiguo" },
  { value: "name", label: "Nombre (A–Z)" },
];

type SP = Record<string, string | string[] | undefined>;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const sp = await searchParams;
  const restore = await getRestorableListParams(ctx, "lead", sp, LEAD_PRESETS.map((p) => p.id));
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (!can(access, "lead", "view")) return <NoAccess what="los leads" />;
  const display = sp.display === "kanban" ? "kanban" : "list";
  const filters = { ...parseLeadFilters(sp, ctx.userId), scope: scopeWhere(access, "lead") };
  const [leads, toolbar] = await Promise.all([listLeads(ctx.businessId, filters), getToolbarData(ctx, "lead")]);
  const names = memberNames(toolbar.members);
  const allColumns = [...LEAD_COLUMNS, ...customColumns(toolbar.customFieldDefs)];
  const columns = resolveColumns(allColumns, LEAD_DEFAULT_COLUMNS, typeof sp.cols === "string" ? sp.cols : undefined);
  const custom =
    display === "list" ? await loadCustomCells(ctx.businessId, toolbar.customFieldDefs, columns, leads.map((l) => l.id)) : undefined;
  const hasFilters = Object.keys(sp).some((k) => !["display", "cols", "sort", "view"].includes(k));

  return (
    <div>
      <PageHeader
        title="Leads"
        description={`${leads.length} ${leads.length === 1 ? "lead" : "leads"}${hasFilters ? " con estos filtros" : ""}`}
        actions={
          <>
            {can(access, "lead", "create") && <SyncNexoButton />}
            {can(access, "lead", "create") && (
              <Link href="/dashboard/leads/nuevo">
                <Button>
                  <PlusIcon className="h-4 w-4" />
                  Nuevo lead
                </Button>
              </Link>
            )}
          </>
        }
      />

      <ListToolbar
        entity="lead"
        searchPlaceholder="Buscar por nombre, email o teléfono…"
        filters={toolbar.filters}
        columns={allColumns}
        defaultColumns={LEAD_DEFAULT_COLUMNS}
        sortOptions={SORT_OPTIONS}
        presets={LEAD_PRESETS}
        savedViews={toolbar.savedViews}
        canShare={toolbar.canShare}
        display={display}
        defaultDisplay="list"
        exportPath="/api/export/leads"
        canExport={can(access, "lead", "export")}
      />
      <ListPreferenceSync entity="lead" restore={restore} />

      {leads.length === 0 ? (
        hasFilters ? (
          <EmptyState title="Ningún lead coincide con estos filtros" description="Probá con otra búsqueda o quitá algún filtro." />
        ) : (
          <EmptyState
            icon={<TargetIcon className="h-5 w-5" />}
            title="Todavía no hay leads"
            description="Cargá tu primer prospecto, importalos desde un Excel o sincronizá las consultas y reservas de Nexo."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/dashboard/leads/nuevo">
                  <Button>
                    <PlusIcon className="h-4 w-4" />
                    Nuevo lead
                  </Button>
                </Link>
                <Link href="/dashboard/importar">
                  <Button variant="secondary">Importar</Button>
                </Link>
              </div>
            }
          />
        )
      ) : (
        <RecordSelection entityType="lead" ids={leads.map((l) => l.id)} noun={RECORD_NOUNS.lead} canDelete={can(access, "lead", "delete")}>
          {display === "kanban" ? (
            <>
              <SelectAllBar />
              <LeadBoard
                statuses={toolbar.leadStatuses}
                leads={leads.map((l) => ({
                  id: l.id,
                  name: l.name,
                  email: l.email,
                  phone: l.phone,
                  status: l.status,
                  source: l.source,
                  company: l.company,
                  ownerName: l.ownerId ? (names.get(l.ownerId) ?? null) : null,
                  createdAt: l.createdAt,
                  lastFollowUpAt: l.lastFollowUpAt,
                }))}
              />
            </>
          ) : (
            <LeadTable
              leads={leads}
              columns={columns}
              statusOf={(key) => findStatusOption(toolbar.leadStatuses, key)}
              ownerName={(id) => names.get(id)}
              custom={custom}
            />
          )}
        </RecordSelection>
      )}
    </div>
  );
}
