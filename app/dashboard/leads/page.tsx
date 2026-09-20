import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listLeads } from "@/modules/leads/service";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { SyncNexoButton } from "@/components/leads/sync-nexo-button";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { q, status } = await searchParams;
  const [leads, statuses] = await Promise.all([
    listLeads(ctx.businessId, { search: q, status }),
    listStatusDefinitions(ctx.businessId, "lead"),
  ]);
  const statusLabel = (key: string) => statuses.find((s) => s.key === key)?.label ?? key;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Prospectos propios de tu negocio — distintos del pipeline comercial de Kodexa."
        actions={
          <div className="flex items-center gap-2">
            <SyncNexoButton />
            <Link href="/dashboard/leads/nuevo">
              <Button>Nuevo lead</Button>
            </Link>
          </div>
        }
      />

      <SearchFilterBar
        searchPlaceholder="Buscar por nombre, email o teléfono…"
        statusOptions={statuses.map((s) => ({ value: s.key, label: s.label }))}
      />

      {leads.length === 0 ? (
        <EmptyState
          title="Todavía no hay leads cargados"
          action={
            <Link href="/dashboard/leads/nuevo">
              <Button>Nuevo lead</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Creado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/leads/${l.id}`} className="font-medium text-slate-900 hover:underline">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.company?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge>{statusLabel(l.status)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {l.source?.startsWith("nexo_") ? (
                      <Badge className="bg-indigo-100 text-indigo-700">{LEAD_SOURCE_LABELS[l.source]}</Badge>
                    ) : (
                      <span className="text-slate-500">{LEAD_SOURCE_LABELS[l.source ?? "manual"] ?? l.source}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.createdAt.toLocaleDateString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
