import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { globalSearch } from "@/modules/search/service";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";

export default async function GlobalSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { q } = await searchParams;
  const results = await globalSearch(ctx.businessId, q ?? "");
  const total = results.companies.length + results.contacts.length + results.leads.length + results.opportunities.length;

  return (
    <div>
      <PageHeader title="Buscar" />
      <SearchFilterBar searchPlaceholder="Buscar empresas, contactos, leads, oportunidades…" />

      {!q ? (
        <EmptyState title="Escribí algo para buscar" />
      ) : total === 0 ? (
        <EmptyState title={`Sin resultados para "${q}"`} />
      ) : (
        <div className="space-y-6">
          <ResultSection title="Empresas" items={results.companies.map((c) => ({ id: c.id, label: c.name }))} basePath="/dashboard/empresas" />
          <ResultSection title="Contactos" items={results.contacts.map((c) => ({ id: c.id, label: c.name }))} basePath="/dashboard/contactos" />
          <ResultSection title="Leads" items={results.leads.map((l) => ({ id: l.id, label: l.name }))} basePath="/dashboard/leads" />
          <ResultSection
            title="Oportunidades"
            items={results.opportunities.map((o) => ({ id: o.id, label: o.title }))}
            basePath="/dashboard/oportunidades"
          />
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, items, basePath }: { title: string; items: { id: string; label: string }[]; basePath: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>
      <Card className="divide-y divide-slate-100">
        {items.map((item) => (
          <Link key={item.id} href={`${basePath}/${item.id}`} className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            {item.label}
          </Link>
        ))}
      </Card>
    </div>
  );
}
