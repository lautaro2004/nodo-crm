import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole, assignableRoles } from "@/lib/permissions";
import { availableProducts, listTeam } from "@/modules/team/service";
import { PageHeader } from "@/components/ui/primitives";
import { AdminOnly } from "@/components/team/admin-only";
import { TeamManager } from "@/components/team/team-manager";
import { listRoles } from "@/modules/access/service";

export default async function TeamPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const header = (
    <PageHeader
      title="Equipo"
      description="Invitá empleados, definí su rol y a qué productos acceden. Vale para Nodo y Nexo: es el mismo equipo."
      backHref="/dashboard/configuracion"
      backLabel="Configuración"
    />
  );
  if (!hasRole(ctx.role, "admin")) {
    return (
      <div>
        {header}
        <AdminOnly />
      </div>
    );
  }

  const [team, products, roles] = await Promise.all([listTeam(ctx.businessId), availableProducts(ctx.businessId), listRoles(ctx.businessId)]);
  return (
    <div>
      {header}
      <TeamManager
        accessRoles={roles.map((r) => ({ key: r.key, name: r.name }))}
        me={{ userId: ctx.userId, role: ctx.role }}
        assignable={assignableRoles(ctx.role)}
        products={products}
        members={team.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          products: m.products,
          createdAt: m.createdAt.toISOString(),
        }))}
        invitations={team.invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          products: i.products,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
