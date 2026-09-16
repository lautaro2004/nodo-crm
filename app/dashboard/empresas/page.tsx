import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listCompanies } from "@/modules/companies/service";
import { listTags } from "@/modules/tags/service";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { COMPANY_STATUS_LABELS } from "@/lib/labels";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tagId?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { q, status, tagId } = await searchParams;
  const [companies, tags] = await Promise.all([
    listCompanies(ctx.businessId, { search: q, status, tagId }),
    listTags(ctx.businessId),
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
        statusOptions={Object.entries(COMPANY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
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
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Creada</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/empresas/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                    {c.domain && <p className="text-xs text-slate-400">{c.domain}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge>{COMPANY_STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.createdAt.toLocaleDateString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
