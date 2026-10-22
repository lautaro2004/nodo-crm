import Link from "next/link";
import type { ReactNode } from "react";

import { CustomCell } from "@/components/custom-fields/custom-cell";
import type { CustomCells } from "@/modules/custom-fields/columns";

import { Card, Table, Th, Td } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/status/status-badge";
import { LEAD_COLUMNS } from "@/lib/views/columns";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { SelectAllHeader, SelectCell, SelectableRow } from "@/components/records/selection";

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  statusReason: string | null;
  source: string | null;
  ownerId: string | null;
  company: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  lastFollowUpAt: Date | null;
}

const day = (d: Date) => d.toLocaleDateString("es-AR");

function daysAgo(d: Date) {
  const n = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
}

// Tabla de Leads con columnas configurables (orden y visibilidad vienen
// de la URL, ver lib/views/columns.ts).
export function LeadTable({
  leads,
  columns,
  statusOf,
  ownerName,
  custom,
}: {
  leads: LeadRow[];
  custom?: CustomCells;
  columns: string[];
  statusOf: (key: string) => { label: string; color: string | null };
  ownerName: (id: string) => string | undefined;
}) {
  const cell: Record<string, (l: LeadRow) => ReactNode> = {
    name: (l) => (
      <Link href={`/dashboard/leads/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700">
        {l.name}
      </Link>
    ),
    contact: (l) =>
      l.email || l.phone ? (
        <div className="max-w-56 truncate text-slate-600">
          {l.email && <span className="block truncate">{l.email}</span>}
          {l.phone && <span className="block text-xs text-slate-500">{l.phone}</span>}
        </div>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    company: (l) =>
      l.company ? (
        <Link href={`/dashboard/empresas/${l.company.id}`} className="text-slate-700 hover:text-brand-700">
          {l.company.name}
        </Link>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    status: (l) => {
      const s = statusOf(l.status);
      return <StatusBadge label={s.label} color={s.color} />;
    },
    owner: (l) => (l.ownerId ? <span className="text-slate-700">{ownerName(l.ownerId) ?? "—"}</span> : <span className="text-slate-400">Sin asignar</span>),
    source: (l) =>
      l.source?.startsWith("nexo_") ? (
        <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">{LEAD_SOURCE_LABELS[l.source]}</span>
      ) : (
        <span className="text-slate-500">{LEAD_SOURCE_LABELS[l.source ?? "manual"] ?? l.source}</span>
      ),
    lastFollowUp: (l) =>
      l.lastFollowUpAt ? (
        <span className="whitespace-nowrap text-slate-600" title={day(l.lastFollowUpAt)}>
          {daysAgo(l.lastFollowUpAt)}
        </span>
      ) : (
        <span className="whitespace-nowrap text-amber-700">Sin seguimiento</span>
      ),
    reason: (l) => (l.statusReason ? <span className="text-slate-600">{l.statusReason}</span> : <span className="text-slate-400">—</span>),
    created: (l) => <span className="whitespace-nowrap text-slate-500">{day(l.createdAt)}</span>,
    updated: (l) => <span className="whitespace-nowrap text-slate-500">{day(l.updatedAt)}</span>,
  };
  const label = (key: string) => LEAD_COLUMNS.find((c) => c.key === key)?.label ?? custom?.columns.get(key)?.label ?? key;

  return (
    <Card className="overflow-hidden">
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            <SelectAllHeader />
            {columns.map((c) => (
              <Th key={c}>{label(c)}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <SelectableRow key={l.id} id={l.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
              <SelectCell id={l.id} label={l.name} />
              {columns.map((c) => (
                <Td key={c}>{cell[c] ? cell[c](l) : custom ? <CustomCell custom={custom} columnKey={c} entityId={l.id} /> : null}</Td>
              ))}
            </SelectableRow>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
