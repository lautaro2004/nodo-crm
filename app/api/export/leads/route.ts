import { NextResponse } from "next/server";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { LEAD_COLUMNS, customColumns, resolveColumns } from "@/lib/views/columns";
import { formatCustomValue } from "@/lib/custom-fields";
import { listCustomFieldDefinitions } from "@/modules/custom-fields/service";
import { loadCustomCells } from "@/modules/custom-fields/columns";
import { listLeads } from "@/modules/leads/service";
import { parseLeadFilters } from "@/modules/leads/filters";
import { findStatusOption, listStatusOptions } from "@/modules/status-definitions/service";
import { listWorkspaceMembers } from "@/modules/business/members";

// Exporta exactamente lo que muestra la lista: mismos filtros (misma
// función parseLeadFilters/buildLeadWhere) y, si viene `cols`, las mismas
// columnas en el mismo orden. Sin `cols`, exporta todas.
export async function GET(request: Request) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return NextResponse.json({ error: ctx.status }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const [leads, statuses, members] = await Promise.all([
    listLeads(ctx.businessId, parseLeadFilters(sp, ctx.userId)),
    listStatusOptions(ctx.businessId, "lead"),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const names = new Map(members.map((m) => [m.userId, m.name || m.email]));
  // Sin `cols` se exporta todo, incluidos los campos personalizados.
  const definitions = await listCustomFieldDefinitions(ctx.businessId, "lead");
  const allColumns = [...LEAD_COLUMNS, ...customColumns(definitions)];
  const cols = resolveColumns(allColumns, allColumns.map((c) => c.key), sp.get("cols"));
  const custom = await loadCustomCells(ctx.businessId, definitions, cols, leads.map((x) => x.id));

  // "contact" se separa en dos columnas en el CSV (email y teléfono).
  const header: string[] = [];
  for (const c of cols) {
    if (c === "contact") header.push("Email", "Teléfono");
    else header.push(allColumns.find((x) => x.key === c)!.label);
  }
  const rows = leads.map((l) =>
    cols.flatMap((c): unknown[] => {
      switch (c) {
        case "name":
          return [l.name];
        case "contact":
          return [l.email, l.phone];
        case "company":
          return [l.company?.name];
        case "status":
          return [findStatusOption(statuses, l.status).label];
        case "owner":
          return [l.ownerId ? names.get(l.ownerId) : ""];
        case "source":
          return [LEAD_SOURCE_LABELS[l.source ?? "manual"] ?? l.source];
        case "lastFollowUp":
          return [l.lastFollowUpAt];
        case "reason":
          return [l.statusReason];
        case "created":
          return [l.createdAt];
        case "updated":
          return [l.updatedAt];
        default: {
          const column = custom.columns.get(c);
          return [column ? formatCustomValue(column.type, custom.values.get(l.id)?.get(column.definitionId)) : ""];
        }
      }
    })
  );
  return csvResponse(`leads-${todayStamp()}.csv`, toCsv(header, rows));
}
