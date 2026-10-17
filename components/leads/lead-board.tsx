"use client";

import Link from "next/link";

import { KanbanBoard, patchMove, type BoardColumn } from "@/components/board/kanban-board";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { useReasonPrompt } from "@/components/status/reason-prompt";

interface StatusOption {
  key: string;
  label: string;
  color: string | null;
  requiresReason?: boolean;
  reasonOptions?: string[];
  isRejection?: boolean;
}
interface LeadCard {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  company: { name: string } | null;
  ownerName: string | null;
  createdAt: Date;
  lastFollowUpAt?: Date | null;
}

// Kanban de Leads: columnas = estados configurados del Workspace, en su
// orden. Mover hace PATCH { status } al mismo endpoint que el select del
// detalle; el backend valida que el estado exista y que el lead no esté
// convertido.
//
// "Convertido" es de solo lectura: un lead llega ahí únicamente por el
// asistente de conversión (crea Contacto/Oportunidad en una transacción).
// Leads con un estado que ya no existe en la configuración aparecen en
// una columna propia para que no queden invisibles.
export function LeadBoard({ statuses, leads }: { statuses: StatusOption[]; leads: LeadCard[] }) {
  const reason = useReasonPrompt();
  // Abiertos = ni convertidos ni en un estado de rechazo.
  const closedKeys = new Set(["converted", ...statuses.filter((s) => s.isRejection).map((s) => s.key)]);
  const known = new Set(statuses.map((s) => s.key));
  const orphanKeys = Array.from(new Set(leads.map((l) => l.status).filter((k) => !known.has(k))));

  const columns: BoardColumn[] = [
    ...statuses.map((s) => ({
      id: s.key,
      label: s.label,
      color: s.color,
      droppable: s.key !== "converted",
      emptyLabel: s.key === "converted" ? "Usá “Convertir” desde la ficha del lead" : "Sin leads",
    })),
    ...orphanKeys.map((k) => ({ id: k, label: `${k} (sin configurar)`, color: null, droppable: false })),
  ];

  async function move(lead: LeadCard, status: string) {
    const target = statuses.find((s) => s.key === status);
    let statusReason: string | null = null;
    if (target?.requiresReason) {
      // Campo obligatorio de la transición (el servidor lo valida igual).
      statusReason = await reason.ask(target.label, target.reasonOptions ?? []);
      if (!statusReason) return { ok: false as const, error: "" }; // canceló: la tarjeta vuelve sin aviso
    }
    return patchMove(`/api/leads/${lead.id}`, { status, ...(statusReason ? { statusReason } : {}) });
  }

  return (
    <>
      {reason.element}
      <KanbanBoard
        columns={columns}
        itemNoun="leads"
        items={leads.map((l) => ({ ...l, columnId: l.status, movable: l.status !== "converted" }))}
        onMove={move}
        renderCard={(l) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/dashboard/leads/${l.id}`}
                className="min-w-0 text-sm font-medium leading-snug text-slate-900 hover:text-brand-700"
              >
                {l.name}
              </Link>
              {l.source?.startsWith("nexo_") && (
                <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
                  Nexo
                </span>
              )}
            </div>
            {l.company && <p className="mt-0.5 truncate text-xs text-slate-500">{l.company.name}</p>}
            {(l.email || l.phone) && <p className="mt-1 truncate text-xs text-slate-500">{l.phone ?? l.email}</p>}
            {l.lastFollowUpAt === null && !closedKeys.has(l.status) && (
              <p className="mt-1.5 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                Sin seguimiento
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="truncate" title="Responsable">
                {l.ownerName ?? <span className="text-slate-400">Sin responsable</span>}
              </span>
              <span className="shrink-0 tabular-nums" title={`Origen: ${LEAD_SOURCE_LABELS[l.source ?? "manual"] ?? l.source}`}>
                {new Date(l.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </span>
            </div>
          </div>
        )}
      />
    </>
  );
}
