import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Table, Th, Td, Card } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/status/status-badge";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { stageColorKey } from "@/lib/status-colors";
import { OPPORTUNITY_COLUMNS, OPPORTUNITY_DEFAULT_COLUMNS } from "@/lib/views/columns";

interface OpportunityRow {
  id: string;
  title: string;
  amount: number | null;
  status: string;
  stage: { label: string; color?: string | null; isWon?: boolean; isLost?: boolean };
  company: { name: string } | null;
  contact: { name: string } | null;
  ownerName: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
}

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "danger"> = {
  open: "neutral",
  won: "success",
  lost: "danger",
};

const day = (d: Date) => d.toLocaleDateString("es-AR");

// Lista de Oportunidades con columnas configurables (orden y visibilidad
// desde la URL, ver lib/views/columns.ts).
export function OpportunityTable({ opportunities, columns = OPPORTUNITY_DEFAULT_COLUMNS }: { opportunities: OpportunityRow[]; columns?: string[] }) {
  const cell: Record<string, (o: OpportunityRow) => ReactNode> = {
    title: (o) => (
      <Link href={`/dashboard/oportunidades/${o.id}`} className="font-medium text-slate-900 hover:text-brand-700">
        {o.title}
      </Link>
    ),
    account: (o) => <span className="text-slate-600">{[o.company?.name, o.contact?.name].filter(Boolean).join(" · ") || "—"}</span>,
    stage: (o) => <StatusBadge label={o.stage.label} color={stageColorKey(o.stage)} />,
    status: (o) => <Badge variant={STATUS_BADGE_VARIANT[o.status] ?? "neutral"}>{OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status}</Badge>,
    amount: (o) => <span className="block text-right tabular-nums text-slate-800">{o.amount !== null ? `$${o.amount.toLocaleString("es-AR")}` : "—"}</span>,
    owner: (o) => (o.ownerName ? <span className="text-slate-700">{o.ownerName}</span> : <span className="text-slate-400">Sin asignar</span>),
    created: (o) => <span className="whitespace-nowrap text-slate-500">{day(o.createdAt)}</span>,
    updated: (o) => <span className="whitespace-nowrap text-slate-500">{day(o.updatedAt)}</span>,
    closed: (o) => <span className="whitespace-nowrap text-slate-500">{o.closedAt ? day(o.closedAt) : "—"}</span>,
  };
  const label = (key: string) => OPPORTUNITY_COLUMNS.find((c) => c.key === key)?.label ?? key;

  return (
    <Card className="overflow-hidden">
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((c) => (
              <Th key={c} className={c === "amount" ? "text-right" : undefined}>
                {label(c)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
              {columns.map((c) => (
                <Td key={c}>{cell[c]?.(o)}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
