"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Card, Select } from "@/components/ui/primitives";

interface Stage {
  id: string;
  key: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
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
}

// "Mover oportunidades" sin drag-and-drop (sin librería de DnD instalada
// en esta fase, ver crm-fase3-core.md): cada tarjeta tiene un selector de
// etapa que dispara el PATCH — mismo resultado funcional, alternativa
// explícitamente aceptada por el pedido cuando DnD sería complejidad
// innecesaria. Al mover a una etapa Ganada/Perdida, sincroniza `status`
// automáticamente (antes NO lo hacía: una oportunidad podía terminar en la
// columna "Ganado" con status "open" para siempre, invisible para
// cualquier filtro por status — inconsistencia real que esta fase corrige,
// reusando el mismo endpoint ya validado, sin tocar el backend).
export function OpportunityBoard({ stages, opportunities }: { stages: Stage[]; opportunities: OpportunityCard[] }) {
  const router = useRouter();

  async function moveStage(opportunityId: string, stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    const nextStatus = stage?.isWon ? "won" : stage?.isLost ? "lost" : "open";
    await fetch(`/api/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId, status: nextStatus }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const cards = opportunities.filter((o) => o.stageId === stage.id);
        const total = cards.reduce((sum, o) => sum + (o.amount ?? 0), 0);
        return (
          <div key={stage.id} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                {stage.label}
                {stage.isWon && <Badge variant="success">Ganado</Badge>}
                {stage.isLost && <Badge variant="danger">Perdido</Badge>}
              </h3>
              <span className="text-xs text-slate-400">{cards.length}</span>
            </div>
            {total > 0 && <p className="mb-2 px-1 text-xs text-slate-400">${total.toLocaleString("es-AR")}</p>}
            <div className="space-y-2">
              {cards.map((o) => (
                <Card key={o.id} className="p-3">
                  <Link href={`/dashboard/oportunidades/${o.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {o.title}
                  </Link>
                  {(o.company || o.contact) && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[o.company?.name, o.contact?.name].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    {o.amount !== null ? (
                      <p className="text-sm font-medium text-slate-700">${o.amount.toLocaleString("es-AR")}</p>
                    ) : (
                      <span />
                    )}
                    {o.ownerName && <span className="truncate text-xs text-slate-400">{o.ownerName}</span>}
                  </div>
                  <Select value={stage.id} onChange={(e) => moveStage(o.id, e.target.value)} className="mt-2 text-xs">
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Card>
              ))}
              {cards.length === 0 && <p className="px-1 text-xs text-slate-400">Sin oportunidades</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
