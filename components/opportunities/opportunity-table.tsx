import Link from "next/link";

import { Badge, Table, Th, Td, Card } from "@/components/ui/primitives";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

interface OpportunityRow {
  id: string;
  title: string;
  amount: number | null;
  status: string;
  stage: { label: string };
  company: { name: string } | null;
  contact: { name: string } | null;
  ownerName: string | null;
  createdAt: Date;
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
            <Th>Valor</Th>
            <Th>Responsable</Th>
            <Th>Creada</Th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((o) => (
            <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
              <Td>
                <Link href={`/dashboard/oportunidades/${o.id}`} className="font-medium text-slate-900 hover:underline">
                  {o.title}
                </Link>
              </Td>
              <Td className="text-slate-600">{[o.company?.name, o.contact?.name].filter(Boolean).join(" · ") || "—"}</Td>
              <Td>
                <Badge>{o.stage.label}</Badge>
              </Td>
              <Td>
                <Badge variant={STATUS_BADGE_VARIANT[o.status] ?? "neutral"}>{OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status}</Badge>
              </Td>
              <Td className="text-slate-700">{o.amount !== null ? `$${o.amount.toLocaleString("es-AR")}` : "—"}</Td>
              <Td className="text-slate-600">{o.ownerName ?? "—"}</Td>
              <Td className="text-slate-500">{o.createdAt.toLocaleDateString("es-AR")}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
