import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listLeads } from "@/modules/leads/service";
import { listStatusOptions, findStatusOption } from "@/modules/status-definitions/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { PageHeader, Card, Button, EmptyState, ViewToggle, Table, Th, Td } from "@/components/ui/primitives";
import { PlusIcon, TargetIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/status/status-badge";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { SyncNexoButton } from "@/components/leads/sync-nexo-button";
import { LeadBoard } from "@/components/leads/lead-board";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "updated", label: "Última actualización" },
  { value: "name", label: "Nombre (A–Z)" },
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; ownerId?: string; sort?: string; display?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { q, status, ownerId, sort, display } = await searchParams;
  const isKanban = display === "kanban";
  const [leads, statuses, members] = await Promise.all([
    // En Kanban el estado ES la columna: el filtro por estado no aplica.
    listLeads(ctx.businessId, { search: q, status: isKanban ? undefined : status, ownerId, sort }),
    listStatusOptions(ctx.businessId, "lead"),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));
  const params = new URLSearchParams(Object.entries({ q, status, ownerId, sort }).filter((e): e is [string, string] => !!e[1]));
  const hasFilters = !!(q || ownerId || (!isKanban && status));

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Prospectos de tu negocio: calificalos y convertilos en contactos y oportunidades."
        actions={
          <>
            <SyncNexoButton />
            <Link href="/dashboard/leads/nuevo">
              <Button>
                <PlusIcon className="h-4 w-4" />
                Nuevo lead
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-x-3">
        <div className="min-w-[16rem] flex-1">
          <SearchFilterBar
            key={`${params.toString()}|${display ?? ""}`}
            searchPlaceholder="Buscar por nombre, email o teléfono…"
            statusOptions={isKanban ? undefined : statuses.map((s) => ({ value: s.key, label: s.label }))}
            ownerOptions={members.length > 1 ? members.map((m) => ({ value: m.userId, label: m.name || m.email })) : undefined}
            sortOptions={isKanban ? undefined : SORT_OPTIONS}
          />
        </div>
        <div className="mb-4">
          <ViewToggle basePath="/dashboard/leads" params={params} value={isKanban ? "kanban" : "list"} />
        </div>
      </div>

      {leads.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="Ningún lead coincide con estos filtros"
            description="Probá con otra búsqueda o quitá los filtros."
            action={
              <Link href={isKanban ? "/dashboard/leads?display=kanban" : "/dashboard/leads"}>
                <Button variant="secondary">Quitar filtros</Button>
              </Link>
            }
          />
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
      ) : isKanban ? (
        <LeadBoard
          statuses={statuses}
          leads={leads.map((l) => ({
            id: l.id,
            name: l.name,
            email: l.email,
            phone: l.phone,
            status: l.status,
            source: l.source,
            company: l.company,
            ownerName: l.ownerId ? (memberNameById.get(l.ownerId) ?? null) : null,
            createdAt: l.createdAt,
          }))}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Nombre</Th>
                <Th>Contacto</Th>
                <Th>Estado</Th>
                <Th>Responsable</Th>
                <Th>Origen</Th>
                <Th>Actualizado</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const s = findStatusOption(statuses, l.status);
                return (
                  <tr key={l.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
                    <Td>
                      <Link href={`/dashboard/leads/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {l.name}
                      </Link>
                      {l.company && <p className="text-xs text-slate-500">{l.company.name}</p>}
                    </Td>
                    <Td className="text-slate-600">
                      {l.email || l.phone ? (
                        <div className="max-w-56 truncate">
                          {l.email && <span className="block truncate">{l.email}</span>}
                          {l.phone && <span className="block text-xs text-slate-500">{l.phone}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge label={s.label} color={s.color} />
                    </Td>
                    <Td className="text-slate-600">
                      {l.ownerId ? (memberNameById.get(l.ownerId) ?? "—") : <span className="text-slate-400">Sin asignar</span>}
                    </Td>
                    <Td>
                      {l.source?.startsWith("nexo_") ? (
                        <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                          {LEAD_SOURCE_LABELS[l.source]}
                        </span>
                      ) : (
                        <span className="text-slate-500">{LEAD_SOURCE_LABELS[l.source ?? "manual"] ?? l.source}</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500" title={`Creado el ${l.createdAt.toLocaleDateString("es-AR")}`}>
                      {l.updatedAt.toLocaleDateString("es-AR")}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
