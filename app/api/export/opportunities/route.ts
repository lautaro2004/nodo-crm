import { NextResponse } from "next/server";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { OPPORTUNITY_COLUMNS, customColumns, resolveColumns } from "@/lib/views/columns";
import { formatCustomValue } from "@/lib/custom-fields";
import { listCustomFieldDefinitions } from "@/modules/custom-fields/service";
import { loadCustomCells } from "@/modules/custom-fields/columns";
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
  // Sin `cols` se exporta todo, incluidos los campos personalizados.
  const definitions = await listCustomFieldDefinitions(ctx.businessId, "opportunity");
  const allColumns = [...OPPORTUNITY_COLUMNS, ...customColumns(definitions)];
  const cols = resolveColumns(allColumns, allColumns.map((c) => c.key), sp.get("cols"));
  const custom = await loadCustomCells(ctx.businessId, definitions, cols, opportunities.map((x) => x.id));

  const header: string[] = [];
  for (const c of cols) {
    if (c === "account") header.push("Empresa", "Contacto");
    else header.push(allColumns.find((x) => x.key === c)!.label);
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
        default: {
          const column = custom.columns.get(c);
          return [column ? formatCustomValue(column.type, custom.values.get(o.id)?.get(column.definitionId)) : ""];
        }
      }
    }),
    o.pipeline.name,
  ]);
  return csvResponse(`oportunidades-${todayStamp()}.csv`, toCsv(header, rows));
}
