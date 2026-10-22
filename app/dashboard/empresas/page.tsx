import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listCompanies } from "@/modules/companies/service";
import { listTags } from "@/modules/tags/service";
import { PageHeader, Card, Button, EmptyState } from "@/components/ui/primitives";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { listStatusOptions, findStatusOption } from "@/modules/status-definitions/service";
import { StatusBadge } from "@/components/status/status-badge";
import { hasRole } from "@/lib/permissions";
import { RECORD_NOUNS } from "@/lib/record-nouns";
import { RecordSelection, SelectAllHeader, SelectCell, SelectableRow } from "@/components/records/selection";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tagId?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { q, status, tagId } = await searchParams;
  const [companies, tags, statusOptions] = await Promise.all([
    listCompanies(ctx.businessId, { search: q, status, tagId }),
    listTags(ctx.businessId),
    listStatusOptions(ctx.businessId, "company"),
  ]);

  return (
    <div>
      <PageHeader
        title="Empresas / Clientes"
        description="Cuentas del negocio — prospectos y clientes."
        actions={
          <Link href="/dashboard/empresas/nueva">
            <Button>Nueva empresa</Button>
          </Link>
        }
      />

      <SearchFilterBar
        searchPlaceholder="Buscar por nombre, dominio o teléfono…"
        statusOptions={statusOptions.map((s) => ({ value: s.key, label: s.label }))}
        tagOptions={tags.map((t) => ({ value: t.id, label: t.name }))}
      />

      {companies.length === 0 ? (
        <EmptyState
          title="Todavía no hay empresas cargadas"
          description="Creá la primera para empezar a organizar tus clientes."
          action={
            <Link href="/dashboard/empresas/nueva">
              <Button>Nueva empresa</Button>
            </Link>
          }
        />
      ) : (
        <RecordSelection entityType="company" ids={companies.map((c) => c.id)} noun={RECORD_NOUNS.company} canDelete={hasRole(ctx.role, "admin")}>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <SelectAllHeader plain />
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Creada</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <SelectableRow key={c.id} id={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <SelectCell id={c.id} label={c.name} />
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/empresas/${c.id}`} className="font-medium text-slate-900 hover:underline">
                        {c.name}
                      </Link>
                      {c.domain && <p className="text-xs text-slate-400">{c.domain}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={findStatusOption(statusOptions, c.status).label} color={findStatusOption(statusOptions, c.status).color} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.createdAt.toLocaleDateString("es-AR")}</td>
                  </SelectableRow>
                ))}
              </tbody>
            </table>
          </Card>
        </RecordSelection>
      )}
    </div>
  );
}
