import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listContacts } from "@/modules/contacts/service";
import { PageHeader, Card, Button, EmptyState } from "@/components/ui/primitives";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { hasRole } from "@/lib/permissions";
import { RECORD_NOUNS } from "@/lib/record-nouns";
import { RecordSelection, SelectAllHeader, SelectCell, SelectableRow } from "@/components/records/selection";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { q } = await searchParams;
  const contacts = await listContacts(ctx.businessId, { search: q });

  return (
    <div>
      <PageHeader
        title="Contactos"
        actions={
          <Link href="/dashboard/contactos/nueva">
            <Button>Nuevo contacto</Button>
          </Link>
        }
      />

      <SearchFilterBar searchPlaceholder="Buscar por nombre, email o teléfono…" />

      {contacts.length === 0 ? (
        <EmptyState
          title="Todavía no hay contactos cargados"
          action={
            <Link href="/dashboard/contactos/nueva">
              <Button>Nuevo contacto</Button>
            </Link>
          }
        />
      ) : (
        <RecordSelection entityType="contact" ids={contacts.map((c) => c.id)} noun={RECORD_NOUNS.contact} canDelete={hasRole(ctx.role, "admin")}>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <SelectAllHeader plain />
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Empresa</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <SelectableRow key={c.id} id={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <SelectCell id={c.id} label={c.name} />
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/contactos/${c.id}`} className="font-medium text-slate-900 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.company?.name ?? "—"}</td>
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
