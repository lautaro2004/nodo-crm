"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, Select } from "@/components/ui/primitives";

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
  stageId: string;
  company: { name: string } | null;
}

// "Mover oportunidades" sin drag-and-drop (sin librería de DnD instalada
// en esta fase, ver crm-fase3-core.md): cada tarjeta tiene un selector de
// etapa que dispara el PATCH — mismo resultado funcional, más simple de
// construir y mantener ahora.
export function OpportunityBoard({ stages, opportunities }: { stages: Stage[]; opportunities: OpportunityCard[] }) {
  const router = useRouter();

  async function moveStage(opportunityId: string, stageId: string) {
    await fetch(`/api/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const cards = opportunities.filter((o) => o.stageId === stage.id);
        return (
          <div key={stage.id} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-900">{stage.label}</h3>
              <span className="text-xs text-slate-400">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.map((o) => (
                <Card key={o.id} className="p-3">
                  <Link href={`/dashboard/oportunidades/${o.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {o.title}
                  </Link>
                  {o.company && <p className="text-xs text-slate-500">{o.company.name}</p>}
                  {o.amount !== null && <p className="mt-1 text-sm text-slate-700">${o.amount.toLocaleString("es-AR")}</p>}
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
