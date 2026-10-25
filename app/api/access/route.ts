import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { listMemberAccess, listRoles, listTeams } from "@/modules/access/service";
import { getModuleCatalog } from "@/modules/entities/registry";

// Configuración de equipos, roles y permisos: solo dueño/administrador del
// negocio (rol de EQUIPO). Nadie puede darse permisos a sí mismo desde acá.
export async function GET() {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const [roles, members, teams, modules] = await Promise.all([
    listRoles(ctx.businessId),
    listMemberAccess(ctx.businessId),
    listTeams(ctx.businessId),
    getModuleCatalog(ctx.businessId),
  ]);
  return NextResponse.json({
    roles,
    members,
    teams: teams.map((t) => ({ id: t.id, name: t.name, description: t.description, parentId: t.parentId, leadUserId: t.leadUserId, memberIds: t.members.map((m) => m.userId) })),
    modules: modules.map((m) => ({ entityType: m.entityType, label: m.plural })),
  });
}
