import { NextResponse } from "next/server";

import { requireWorkspace, forbidden } from "@/lib/api-guard";
import { can, scopeWhere } from "@/modules/access/service";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { formatCustomValue } from "@/lib/custom-fields";
import { slugifyModuleKey } from "@/lib/custom-modules";
import { RECORD_COLUMNS, customColumns, resolveColumns } from "@/lib/views/columns";
import { getModuleById, listModuleFields } from "@/modules/custom-modules/service";
import { listAllRecords, parseRecordFilters } from "@/modules/custom-modules/records";
import { loadCustomCells } from "@/modules/custom-fields/columns";
import { listWorkspaceMembers } from "@/modules/business/members";
import { prisma } from "@/lib/prisma";
import { resolveLabels } from "@/modules/records/links";

// CSV de un módulo personalizado: mismos filtros que la lista y, si viene
// `cols`, las mismas columnas. Sin `cols` exporta todos los campos,
// incluidas las relaciones (nombres separados por "; "). Las imágenes no
// se exportan (son archivos privados).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  if (!can(ctx.access, `cm:${id}`, "export")) return forbidden();
  const mod = await getModuleById(ctx.businessId, id);
  if (!mod) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sp = new URL(request.url).searchParams;
  const [records, fields, members] = await Promise.all([
    listAllRecords(ctx.businessId, id, { ...parseRecordFilters(sp, ctx.userId), scope: scopeWhere(ctx.access, `cm:${id}`, { createdByField: "createdById" }) }),
    listModuleFields(ctx.businessId, id),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const names = new Map(members.map((m) => [m.userId, m.name || m.email]));
  const exportable = fields.filter((f) => f.type !== "image" && f.type !== "file");
  const allColumns = [...RECORD_COLUMNS, ...customColumns(exportable)];
  const cols = resolveColumns(allColumns, allColumns.map((c) => c.key), sp.get("cols"));
  const ids = records.map((r) => r.id);
  const custom = await loadCustomCells(ctx.businessId, exportable, cols, ids);

  // Relaciones: nombres de los registros vinculados.
  const relationIds = new Set(exportable.filter((f) => f.type === "relation").map((f) => f.id));
  const links = relationIds.size
    ? await prisma.recordLink.findMany({ where: { businessId: ctx.businessId, definitionId: { in: Array.from(relationIds) }, fromId: { in: ids } } })
    : [];
  const labels = await resolveLabels(ctx.businessId, links.map((l) => ({ type: l.toType, id: l.toId })));
  const linkText = (recordId: string, defId: string) =>
    links
      .filter((l) => l.fromId === recordId && l.definitionId === defId)
      .map((l) => labels.get(`${l.toType}:${l.toId}`)?.label)
      .filter(Boolean)
      .join("; ");

  const header = cols.map((c) => allColumns.find((x) => x.key === c)!.label);
  const rows = records.map((r) =>
    cols.map((c): unknown => {
      if (c === "title") return r.title;
      if (c === "owner") return r.ownerId ? names.get(r.ownerId) : "";
      if (c === "created") return r.createdAt;
      if (c === "updated") return r.updatedAt;
      const column = custom.columns.get(c);
      if (!column) return "";
      if (relationIds.has(column.definitionId)) return linkText(r.id, column.definitionId);
      return formatCustomValue(column.type, custom.values.get(r.id)?.get(column.definitionId));
    })
  );
  return csvResponse(`${slugifyModuleKey(mod.labelPlural)}-${todayStamp()}.csv`, toCsv(header, rows));
}
