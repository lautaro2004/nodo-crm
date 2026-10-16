import Link from "next/link";

import { Badge, Table, Th, Td, Card } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/status/status-badge";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { stageColorKey } from "@/lib/status-colors";

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
}

const STATUS_BADGE_VARIANT: Record<string, "neutral" | "success" | "danger"> = {
  open: "neutral",
  won: "success",
  lost: "danger",
};

// Vista lista de Oportunidades — antes esta pantalla SOLO tenía Kanban,
// sin ninguna forma de buscar/ordenar/administrar en tabla (gap real
// detectado en la auditoría de esta fase). Mismo patrón de tabla que ya
// usan Empresas/Contactos/Leads.
export function OpportunityTable({ opportunities }: { opportunities: OpportunityRow[] }) {
  return (
    <Card className="overflow-x-auto">
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            <Th>Título</Th>
            <Th>Empresa / Contacto</Th>
            <Th>Etapa</Th>
            <Th>Estado</Th>
            <Th className="text-right">Valor</Th>
            <Th>Responsable</Th>
            <Th>Actualizada</Th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80">
              <Td>
                <Link href={`/dashboard/oportunidades/${o.id}`} className="font-medium text-slate-900 hover:underline">
                  {o.title}
                </Link>
              </Td>
              <Td className="text-slate-600">{[o.company?.name, o.contact?.name].filter(Boolean).join(" · ") || "—"}</Td>
              <Td>
                <StatusBadge label={o.stage.label} color={stageColorKey(o.stage)} />
              </Td>
              <Td>
                <Badge variant={STATUS_BADGE_VARIANT[o.status] ?? "neutral"}>{OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status}</Badge>
              </Td>
              <Td className="text-right tabular-nums text-slate-800">{o.amount !== null ? `$${o.amount.toLocaleString("es-AR")}` : "—"}</Td>
              <Td className="text-slate-600">{o.ownerName ?? <span className="text-slate-400">Sin asignar</span>}</Td>
              <Td className="whitespace-nowrap text-slate-500" title={`Creada el ${o.createdAt.toLocaleDateString("es-AR")}`}>
                {o.updatedAt.toLocaleDateString("es-AR")}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
