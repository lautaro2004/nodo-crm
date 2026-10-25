import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { PageHeader } from "@/components/ui/primitives";
import { AccessManager } from "@/components/team/access-manager";
import { listMemberAccess, listRoles, listTeams } from "@/modules/access/service";
import { getModuleCatalog } from "@/modules/entities/registry";

// Equipos, roles y permisos: solo dueño/administrador del negocio.
export default async function PermissionsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  const [roles, members, teams, modules] = await Promise.all([listRoles(ctx.businessId), listMemberAccess(ctx.businessId), listTeams(ctx.businessId), getModuleCatalog(ctx.businessId)]);

  return (
    <div>
      <PageHeader
        title="Equipos y permisos"
        description="Qué puede ver y hacer cada persona en cada módulo, y cómo se organiza el equipo."
        backHref="/dashboard/configuracion"
        backLabel="Configuración"
      />
      <AccessManager
        roles={roles.map((r) => ({ key: r.key, name: r.name, description: r.description, system: r.system, policy: r.policy, memberCount: r.memberCount }))}
        members={members}
        teams={teams.map((t) => ({ id: t.id, name: t.name, description: t.description, parentId: t.parentId, leadUserId: t.leadUserId, memberIds: t.members.map((m) => m.userId) }))}
        modules={modules.map((m) => ({ entityType: m.entityType, label: m.plural }))}
        currentUserId={ctx.userId}
        isOwner={ctx.role === "owner"}
      />
    </div>
  );
}
