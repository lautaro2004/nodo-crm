import { prisma } from "@/lib/prisma";
import { assignableRoles, canManage, hasRole, normalizeRole, type Product, type Role } from "@/lib/permissions";
import { businessHasNexo } from "@/modules/nexo/subscription";
import { INVITATION_TTL_DAYS, hashInvitationToken, newInvitationToken } from "@/modules/team/tokens";
import { applyInvitationAccess, removeMemberAccessData } from "@/modules/access/service";

// Equipo de un negocio — compartido por Nodo y Nexo (public.Membership).
// Lo que se cambia acá vale para los dos productos: quitar a alguien lo
// saca de ambos; `products` decide a cuál entra.
//
// Reglas:
// - Gestiona el equipo: owner y admin (requireWorkspace({ minRole: "admin" })).
// - Solo se gestiona a quien tiene un rol MENOR (un admin no toca a otro
//   admin ni al dueño; nadie se modifica a sí mismo).
// - Solo se asignan roles por debajo del propio; "owner" nunca se asigna.
// - Productos ofrecibles = los que el negocio tiene: Nodo (Workspace) y
//   Nexo (nexo.Subscription). Siempre al menos uno.
// - Un usuario pertenece a un solo negocio (decisión de producto): no se
//   invita ni se acepta si ese email ya está en otro negocio.

export interface Actor {
  userId: string;
  role: Role;
}

export async function availableProducts(businessId: string): Promise<Product[]> {
  const [workspace, nexo] = await Promise.all([
    prisma.workspace.findUnique({ where: { businessId }, select: { businessId: true } }),
    businessHasNexo(businessId),
  ]);
  return [...(workspace ? (["crm"] as const) : []), ...(nexo ? (["nexo"] as const) : [])];
}

async function validateProducts(businessId: string, products: string[]): Promise<Product[]> {
  const available = await availableProducts(businessId);
  const unique = Array.from(new Set(products));
  if (unique.length === 0) throw new Error("products_required");
  if (unique.some((p) => !available.includes(p as Product))) throw new Error("product_not_available");
  return unique as Product[];
}

function assertCanAssign(actor: Actor, role: string) {
  if (!assignableRoles(actor.role).includes(normalizeRole(role)) || role === "owner") throw new Error("forbidden");
}

export async function listTeam(businessId: string) {
  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { businessId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { businessId, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { members, invitations };
}

export async function createInvitation(
  businessId: string,
  actor: Actor,
  input: { email: string; role: string; products: string[] },
  now: Date = new Date()
) {
  if (!hasRole(actor.role, "admin")) throw new Error("forbidden");
  const email = input.email.trim().toLowerCase();
  assertCanAssign(actor, input.role);
  const products = await validateProducts(businessId, input.products);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const existing = await prisma.membership.findFirst({ where: { userId: user.id }, select: { businessId: true } });
    if (existing?.businessId === businessId) throw new Error("already_member");
    if (existing) throw new Error("email_in_other_business");
  }

  const { token, tokenHash } = newInvitationToken();
  const invitation = await prisma.$transaction(async (tx) => {
    // Una sola invitación pendiente por (negocio, email): reinvitar revoca
    // la anterior (su link deja de funcionar).
    await tx.invitation.updateMany({
      where: { businessId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    return tx.invitation.create({
      data: {
        businessId,
        email,
        role: normalizeRole(input.role),
        products,
        tokenHash,
        invitedById: actor.userId,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000),
      },
    });
  });
  return { invitation, token };
}

export async function revokeInvitation(businessId: string, actor: Actor, id: string, now: Date = new Date()) {
  if (!hasRole(actor.role, "admin")) throw new Error("forbidden");
  const inv = await prisma.invitation.findFirst({ where: { id, businessId, acceptedAt: null, revokedAt: null } });
  if (!inv) return false;
  if (!canManage(actor.role, inv.role)) throw new Error("forbidden");
  await prisma.invitation.updateMany({ where: { id, businessId, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
  return true;
}

export async function updateMember(
  businessId: string,
  actor: Actor,
  membershipId: string,
  data: { role?: string; products?: string[] }
) {
  if (!hasRole(actor.role, "admin")) throw new Error("forbidden");
  const target = await prisma.membership.findFirst({ where: { id: membershipId, businessId } });
  if (!target) return null;
  if (target.userId === actor.userId || !canManage(actor.role, target.role)) throw new Error("forbidden");
  if (data.role !== undefined) assertCanAssign(actor, data.role);
  const products = data.products !== undefined ? await validateProducts(businessId, data.products) : undefined;

  return prisma.membership.update({
    where: { id: target.id },
    data: {
      ...(data.role !== undefined ? { role: normalizeRole(data.role) } : {}),
      ...(products ? { products } : {}),
    },
  });
}

// Quitar a alguien del negocio: pierde acceso a Nodo Y a Nexo. Sus
// registros del CRM quedan "Sin asignar" (aparecen en la vista "Sin
// responsable") y se desconecta su Google en este negocio. No se borra
// ningún dato del negocio.
export async function removeMember(businessId: string, actor: Actor, membershipId: string) {
  if (!hasRole(actor.role, "admin")) throw new Error("forbidden");
  const target = await prisma.membership.findFirst({ where: { id: membershipId, businessId } });
  if (!target) return false;
  if (target.userId === actor.userId || !canManage(actor.role, target.role)) throw new Error("forbidden");

  const owned = { businessId, ownerId: target.userId };
  await prisma.$transaction([
    prisma.lead.updateMany({ where: owned, data: { ownerId: null } }),
    prisma.opportunity.updateMany({ where: owned, data: { ownerId: null } }),
    prisma.company.updateMany({ where: owned, data: { ownerId: null } }),
    prisma.contact.updateMany({ where: owned, data: { ownerId: null } }),
    prisma.task.updateMany({ where: owned, data: { ownerId: null } }),
    prisma.googleConnection.deleteMany({ where: { businessId, userId: target.userId } }),
    prisma.membership.deleteMany({ where: { id: target.id, businessId } }),
  ]);
  // Equipos, rol y excepciones de Nodo de quien se va.
  await removeMemberAccessData(businessId, target.userId);
  return true;
}

// ── Aceptación ──────────────────────────────────────────────────────────

export type InvitationState =
  | { status: "invalid" }
  | { status: "expired" | "revoked" | "accepted"; businessName: string }
  | { status: "pending"; id: string; businessId: string; businessName: string; email: string; role: Role; products: Product[]; inviterName: string | null };

export async function getInvitationByToken(token: string, now: Date = new Date()): Promise<InvitationState> {
  if (!token || token.length < 20) return { status: "invalid" };
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { business: { select: { name: true } }, invitedBy: { select: { name: true } } },
  });
  if (!inv) return { status: "invalid" };
  const businessName = inv.business.name;
  if (inv.acceptedAt) return { status: "accepted", businessName };
  if (inv.revokedAt) return { status: "revoked", businessName };
  if (inv.expiresAt <= now) return { status: "expired", businessName };
  return {
    status: "pending",
    id: inv.id,
    businessId: inv.businessId,
    businessName,
    email: inv.email,
    role: normalizeRole(inv.role),
    products: inv.products as Product[],
    inviterName: inv.invitedBy?.name ?? null,
  };
}

export async function acceptInvitation(token: string, user: { id: string; email: string }, now: Date = new Date()) {
  const state = await getInvitationByToken(token, now);
  if (state.status === "invalid") throw new Error("invitation_invalid");
  if (state.status !== "pending") throw new Error(`invitation_${state.status}`);
  if (state.email !== user.email.trim().toLowerCase()) throw new Error("invitation_wrong_email");

  let created = false;
  const membership = await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findFirst({ where: { userId: user.id } });
    if (existing && existing.businessId !== state.businessId) throw new Error("email_in_other_business");

    // Marca la invitación como usada SOLO si sigue pendiente: dos clicks
    // simultáneos no crean dos membresías.
    const claimed = await tx.invitation.updateMany({
      where: { id: state.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    if (claimed.count === 0) throw new Error("invitation_accepted");

    if (existing) return existing; // ya era miembro (ej. reinvitación): no se pisa su rol
    created = true;
    return tx.membership.create({
      data: { userId: user.id, businessId: state.businessId, role: state.role, products: state.products },
    });
  });
  // Rol de Nodo elegido al invitar (ej. "Solo lectura" para un externo).
  if (created) await applyInvitationAccess(state.id, user.id);
  return membership;
}
