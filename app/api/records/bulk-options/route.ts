import { NextResponse } from "next/server";

import { requireWorkspace, forbidden } from "@/lib/api-guard";
import { can } from "@/modules/access/service";
import { bulkKindsFor, isBulkEntity } from "@/modules/records/bulk";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { listPipelines } from "@/modules/pipelines/service";

// Opciones para el menú "Acciones masivas": responsables asignables, estados
// (leads/empresas) y etapas por pipeline (oportunidades). Solo lectura.
export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const entityType = new URL(request.url).searchParams.get("entityType") ?? "";
  if (!isBulkEntity(entityType)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!can(ctx.access, entityType, "edit")) return forbidden();

  const kinds = bulkKindsFor(entityType);
  const [members, statuses, pipelines] = await Promise.all([
    listWorkspaceMembers(ctx.businessId),
    kinds.includes("status") ? listStatusOptions(ctx.businessId, entityType === "company" ? "company" : "lead") : Promise.resolve([]),
    kinds.includes("stage") ? listPipelines(ctx.businessId) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    kinds,
    owners: members.map((m) => ({ value: m.userId, label: m.name || m.email })),
    // "Convertido" solo se alcanza con la acción "Convertir lead".
    statuses: statuses
      .filter((s) => !(entityType === "lead" && s.key === "converted"))
      .map((s) => ({ value: s.key, label: s.label, requiresReason: !!s.requiresReason, reasonOptions: s.reasonOptions ?? [] })),
    pipelines: pipelines.map((p) => ({ id: p.id, name: p.name, stages: p.stages.map((s) => ({ value: s.id, label: s.label })) })),
  });
}
