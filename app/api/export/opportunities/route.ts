import { NextResponse } from "next/server";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { OPPORTUNITY_COLUMNS, resolveColumns } from "@/lib/views/columns";
import { listOpportunities } from "@/modules/opportunities/service";
import { parseOpportunityFilters } from "@/modules/opportunities/filters";
import { listWorkspaceMembers } from "@/modules/business/members";

// Mismos filtros y columnas que la lista de Oportunidades.
export async function GET(request: Request) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return NextResponse.json({ error: ctx.status }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const [opportunities, members] = await Promise.all([
    listOpportunities(ctx.businessId, parseOpportunityFilters(sp, ctx.userId)),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const names = new Map(members.map((m) => [m.userId, m.name || m.email]));
  const cols = resolveColumns(OPPORTUNITY_COLUMNS, OPPORTUNITY_COLUMNS.map((c) => c.key), sp.get("cols"));

  const header: string[] = [];
  for (const c of cols) {
    if (c === "account") header.push("Empresa", "Contacto");
    else header.push(OPPORTUNITY_COLUMNS.find((x) => x.key === c)!.label);
  }
  header.push("Pipeline");
  const rows = opportunities.map((o) => [
    ...cols.flatMap((c): unknown[] => {
      switch (c) {
        case "title":
          return [o.title];
        case "account":
          return [o.company?.name, o.contact?.name];
        case "stage":
          return [o.stage.label];
        case "status":
          return [OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status];
        case "amount":
          return [o.amount ?? ""];
        case "owner":
          return [o.ownerId ? names.get(o.ownerId) : ""];
        case "created":
          return [o.createdAt];
        case "updated":
          return [o.updatedAt];
        case "closed":
          return [o.closedAt];
        default:
          return [""];
      }
    }),
    o.pipeline.name,
  ]);
  return csvResponse(`oportunidades-${todayStamp()}.csv`, toCsv(header, rows));
}
