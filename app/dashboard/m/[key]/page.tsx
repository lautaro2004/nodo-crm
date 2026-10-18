import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { moduleEntityType } from "@/lib/custom-modules";
import { RECORD_COLUMNS, customColumns, recordDefaultColumns, resolveColumns } from "@/lib/views/columns";
import { getModuleByKey } from "@/modules/custom-modules/service";
import { listRecords, parseRecordFilters } from "@/modules/custom-modules/records";
import { loadCustomCells } from "@/modules/custom-fields/columns";
import { getToolbarData, memberNames } from "@/modules/views/toolbar-data";
import { recordThumbnails } from "@/modules/records/images";
import { Button, EmptyState, PageHeader } from "@/components/ui/primitives";
import { PlusIcon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";
import { ListToolbar } from "@/components/views/list-toolbar";
import { RecordTable } from "@/components/custom-modules/record-table";
import { CustomModuleIcon } from "@/components/custom-modules/custom-module-icon";

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "updated", label: "Última actualización" },
  { value: "title", label: "Nombre (A–Z)" },
];

type SP = Record<string, string | string[] | undefined>;

export default async function CustomModulePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<SP> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  const { key } = await params;
  const mod = await getModuleByKey(ctx.businessId, key);
  if (!mod || mod.archivedAt) notFound();

  const sp = await searchParams;
  const entity = moduleEntityType(mod.id);
  const filters = parseRecordFilters(sp, ctx.userId);
  const [result, toolbar] = await Promise.all([listRecords(ctx.businessId, mod.id, filters), getToolbarData(ctx, entity)]);
  const names = memberNames(toolbar.members);

  const fieldColumns = customColumns(toolbar.customFieldDefs.filter((d) => d.type !== "image" && d.type !== "relation"));
  const allColumns = [...RECORD_COLUMNS, ...fieldColumns];
  const defaults = recordDefaultColumns(fieldColumns);
  const columns = resolveColumns(allColumns, defaults, typeof sp.cols === "string" ? sp.cols : undefined);
  const custom = await loadCustomCells(ctx.businessId, toolbar.customFieldDefs, columns, result.items.map((r) => r.id));
  const thumbs = mod.imageFieldId ? await recordThumbnails(ctx.businessId, mod.imageFieldId, result.items.map((r) => r.id)) : undefined;

  const basePath = `/dashboard/m/${mod.key}`;
  const hasFilters = Object.keys(sp).some((k) => !["cols", "sort", "view", "page", "archived"].includes(k));
  const archived = filters.archived;
  const singular = mod.labelSingular.toLowerCase();

  return (
    <div>
      <PageHeader
        title={archived ? `${mod.labelPlural} archivados` : mod.labelPlural}
        description={`${result.total} ${result.total === 1 ? singular : mod.labelPlural.toLowerCase()}${hasFilters ? " con estos filtros" : ""}${mod.description && !hasFilters ? ` · ${mod.description}` : ""}`}
        backHref={archived ? basePath : undefined}
        backLabel={mod.labelPlural}
        actions={
          <>
            {hasRole(ctx.role, "admin") && (
              <Link href={`/dashboard/configuracion/modulos/${mod.id}`}>
                <Button variant="ghost">Configurar</Button>
              </Link>
            )}
            {!archived && (
              <Link href={`${basePath}?archived=1`}>
                <Button variant="secondary">Archivados</Button>
              </Link>
            )}
            <Link href={`${basePath}/nuevo`}>
              <Button>
                <PlusIcon className="h-4 w-4" />
                Nuevo {singular}
              </Button>
            </Link>
          </>
        }
      />

      <ListToolbar
        entity={entity}
        searchPlaceholder="Buscar por nombre…"
        filters={toolbar.filters}
        columns={allColumns}
        defaultColumns={defaults}
        sortOptions={SORT_OPTIONS}
        presets={[]}
        savedViews={toolbar.savedViews}
        canShare={toolbar.canShare}
        display="list"
        defaultDisplay="list"
        displays={["list"]}
        exportPath={`/api/export/modules/${mod.id}`}
      />

      {result.items.length === 0 ? (
        hasFilters ? (
          <EmptyState title="Nada coincide con estos filtros" description="Probá con otra búsqueda o quitá algún filtro." />
        ) : archived ? (
          <EmptyState title="No hay registros archivados" description="Lo que archives aparece acá y se puede restaurar." />
        ) : (
          <EmptyState
            icon={<CustomModuleIcon iconName={mod.icon} className="h-5 w-5" />}
            title={`Todavía no hay ${mod.labelPlural.toLowerCase()}`}
            description="Cargá el primero o importalos desde un Excel."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href={`${basePath}/nuevo`}>
                  <Button>
                    <PlusIcon className="h-4 w-4" />
                    Nuevo {singular}
                  </Button>
                </Link>
                {hasRole(ctx.role, "admin") && (
                  <Link href="/dashboard/importar">
                    <Button variant="secondary">Importar</Button>
                  </Link>
                )}
              </div>
            }
          />
        )
      ) : (
        <>
          <RecordTable basePath={basePath} records={result.items} columns={columns} custom={custom} ownerName={(id) => names.get(id)} thumbs={thumbs} />
          <Pagination basePath={basePath} params={sp} page={result.page} pageSize={result.pageSize} total={result.total} />
        </>
      )}
    </div>
  );
}
