"use client";

import Link from "next/link";

import { KanbanBoard, patchMove, type BoardColumn } from "@/components/board/kanban-board";
import { stageColorKey } from "@/lib/status-colors";

interface Stage {
  id: string;
  key: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
  color?: string | null;
}
interface OpportunityCard {
  id: string;
  title: string;
  amount: number | null;
  status: string;
  stageId: string;
  company: { name: string } | null;
  contact: { name: string } | null;
  ownerName: string | null;
  updatedAt: Date;
}

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

function daysSince(date: Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

// Kanban de Oportunidades: columnas = etapas del pipeline. Mover una
// tarjeta hace PATCH { stageId } — el backend valida que la etapa sea del
// mismo pipeline y deriva el status (Ganado/Perdido/abierta) y closedAt;
// el navegador ya no decide el status (ver modules/opportunities/service.ts).
export function OpportunityBoard({
  stages,
  opportunities,
  stalledDays,
}: {
  stages: Stage[];
  opportunities: OpportunityCard[];
  stalledDays: number;
}) {
  const columns: BoardColumn[] = stages.map((stage) => {
    const total = opportunities.filter((o) => o.stageId === stage.id).reduce((sum, o) => sum + (o.amount ?? 0), 0);
    return {
      id: stage.id,
      label: stage.label,
      color: stageColorKey(stage),
      meta: total > 0 ? <span className="tabular-nums">{money(total)}</span> : undefined,
      emptyLabel: "Sin oportunidades",
    };
  });

  return (
    <KanbanBoard
      columns={columns}
      itemNoun="oportunidades"
      items={opportunities.map((o) => ({ ...o, columnId: o.stageId }))}
      onMove={(o, stageId) => patchMove(`/api/opportunities/${o.id}`, { stageId })}
      renderCard={(o) => {
        const idle = o.status === "open" ? daysSince(o.updatedAt) : 0;
        return (
          <div>
            <Link href={`/dashboard/oportunidades/${o.id}`} className="block text-sm font-medium leading-snug text-slate-900 hover:text-brand-700" draggable={false}>
              {o.title}
            </Link>
            {(o.company || o.contact) && (
              <p className="mt-0.5 truncate text-xs text-slate-500">{[o.company?.name, o.contact?.name].filter(Boolean).join(" · ")}</p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {o.amount !== null ? <p className="text-sm font-semibold tabular-nums text-slate-800">{money(o.amount)}</p> : <span className="text-xs text-slate-400">Sin valor</span>}
              <span className="truncate text-[11px] text-slate-500" title="Responsable">
                {o.ownerName ?? <span className="text-slate-400">Sin responsable</span>}
              </span>
            </div>
            {idle >= stalledDays && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                Sin movimiento hace {idle} días
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
