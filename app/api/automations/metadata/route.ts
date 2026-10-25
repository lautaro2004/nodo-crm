import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { getModuleCatalog } from "@/modules/entities/registry";
import { relatedPathsFor } from "@/modules/automations/related";
import { listWorkspaceMembers } from "@/modules/business/members";

// Lo que necesita el constructor de automatizaciones: módulos con sus
// campos (estándar + personalizados, con opciones), relaciones por módulo
// y miembros asignables.
export async function GET() {
  const { ctx, response } = await requireWorkspace({ admin: "automations" });
  if (!ctx) return response;
  const [modules, members] = await Promise.all([getModuleCatalog(ctx.businessId), listWorkspaceMembers(ctx.businessId)]);
  const related = Object.fromEntries(await Promise.all(modules.map(async (m) => [m.entityType, await relatedPathsFor(ctx.businessId, m.entityType)] as const)));
  return NextResponse.json({ modules, related, members: members.map((m) => ({ userId: m.userId, name: m.name || m.email, role: m.role })) });
}
