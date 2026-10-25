import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  OWNER_POLICY,
  SYSTEM_ROLES,
  applyOverrides,
  canAdmin,
  canDo,
  defaultRoleKeyFor,
  isSystemRoleKey,
  modulePermission,
  normalizeOverrides,
  normalizePolicy,
  type AdminPermission,
  type ClientAccess,
  type ModuleAction,
  type PolicyOverrides,
  type RoleDefinition,
} from "@/lib/access";
import { hasRole } from "@/lib/permissions";
import { assertUserBelongsToBusiness, listWorkspaceMembers } from "@/modules/business/members";

// Resolución y administración de permisos de Nodo (ver lib/access.ts).
// Todas las funciones reciben businessId resuelto de la sesión; nada de lo
// que llega del cliente se usa sin revalidar contra el negocio.

export interface ResolvedAccess extends ClientAccess {
  userId: string;
  businessId: string;
  /** Usuarios cuyos registros entran en el alcance "equipo" (incluye al propio usuario). */
  teamUserIds: string[];
}

async function loadRoleDefinition(businessId: string, key: string): Promise<RoleDefinition> {
  const row = await prisma.accessRole.findFirst({ where: { businessId, key } });
  if (row) {
    const fallback = isSystemRoleKey(key) ? SYSTEM_ROLES[key].policy : SYSTEM_ROLES.member.policy;
    return { key, name: row.name, description: row.description ?? "", system: row.system, policy: normalizePolicy(row.permissions, fallback) };
  }
  if (isSystemRoleKey(key)) return SYSTEM_ROLES[key];
  // Rol personalizado borrado: se cae al rol "Miembro" (nunca a más permisos).
  return SYSTEM_ROLES.member;
}

/** Ids de los usuarios del "equipo" de una persona: sus equipos + los sub-equipos que supervisa. */
export async function teamUserIdsFor(businessId: string, userId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: { businessId },
    select: { id: true, parentId: true, leadUserId: true, members: { select: { userId: true } } },
  });
  const ids = new Set<string>([userId]);
  const children = new Map<string, string[]>();
  for (const t of teams) if (t.parentId) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t.id]);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const addTeam = (t: (typeof teams)[number]) => {
    for (const m of t.members) ids.add(m.userId);
    if (t.leadUserId) ids.add(t.leadUserId);
  };
  for (const t of teams) {
    const isMember = t.members.some((m) => m.userId === userId);
    if (isMember) addTeam(t);
    if (t.leadUserId === userId) {
      // Supervisor: su equipo y TODOS los sub-equipos (la jerarquía no tiene
      // ciclos: lo garantiza updateTeam; igual se corta por visitados).
      const stack = [t.id];
      const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const team = byId.get(id);
        if (team) addTeam(team);
        stack.push(...(children.get(id) ?? []));
      }
    }
  }
  return Array.from(ids);
}

async function computeAccess(businessId: string, userId: string, membershipRole: string): Promise<ResolvedAccess> {
  if (membershipRole === "owner") {
    return { userId, businessId, isOwner: true, roleKey: "owner", roleName: "Dueño", policy: OWNER_POLICY, teamUserIds: [userId] };
  }
  const member = await prisma.memberAccess.findFirst({ where: { businessId, userId }, include: { role: { select: { key: true } } } });
  const roleKey = member?.role?.key ?? defaultRoleKeyFor(membershipRole);
  const role = await loadRoleDefinition(businessId, roleKey);
  const policy = applyOverrides(role.policy, normalizeOverrides(member?.overrides));
  const needsTeam = Object.values(policy.modules).some((m) => m.scope === "team");
  return {
    userId,
    businessId,
    isOwner: false,
    roleKey: role.key,
    roleName: role.name,
    policy,
    teamUserIds: needsTeam ? await teamUserIdsFor(businessId, userId) : [userId],
  };
}

/**
 * Permisos efectivos de una persona. Memoizado por request en los Server
 * Components (React cache); en route handlers se calcula una vez por
 * llamada a requireWorkspace.
 */
export const resolveAccess = cache(computeAccess);

export function can(access: Pick<ResolvedAccess, "policy">, entityType: string, action: ModuleAction) {
  return canDo(access.policy, entityType, action);
}

export function canAdminister(access: Pick<ResolvedAccess, "policy">, permission: AdminPermission) {
  return canAdmin(access.policy, permission);
}

/**
 * Restricción por responsable para listas/consultas: null = sin
 * restricción (alcance "todos"), o la lista de ownerId permitidos.
 */
export function scopeOwnerIds(access: ResolvedAccess, entityType: string): string[] | null {
  const scope = modulePermission(access.policy, entityType).scope;
  if (scope === "all") return null;
  if (scope === "own") return [access.userId];
  return access.teamUserIds;
}

/** Fragmento `where` de Prisma para el alcance (ownerId y, si existe, creador). */
export function scopeWhere(access: ResolvedAccess, entityType: string, opts: { createdByField?: string } = {}): Record<string, unknown> {
  const ids = scopeOwnerIds(access, entityType);
  if (!ids) return {};
  if (opts.createdByField) return { OR: [{ ownerId: { in: ids } }, { [opts.createdByField]: { in: ids } }] };
  return { ownerId: { in: ids } };
}

/**
 * Responsable por defecto al crear: si la persona solo ve sus registros (o
 * los de su equipo), un alta sin responsable queda a su nombre — si no,
 * desaparecería de su propia lista apenas la crea.
 */
export function defaultOwnerFor(access: ResolvedAccess, entityType: string, ownerId: string | null | undefined) {
  if (ownerId !== undefined && ownerId !== null && ownerId !== "") return ownerId;
  return modulePermission(access.policy, entityType).scope === "all" ? ownerId : access.userId;
}

export function canSeeRecord(access: ResolvedAccess, entityType: string, record: { ownerId: string | null; createdById?: string | null }) {
  if (!can(access, entityType, "view")) return false;
  const ids = scopeOwnerIds(access, entityType);
  if (!ids) return true;
  return (!!record.ownerId && ids.includes(record.ownerId)) || (!!record.createdById && ids.includes(record.createdById));
}

export function toClientAccess(access: ResolvedAccess): ClientAccess {
  return { isOwner: access.isOwner, roleKey: access.roleKey, roleName: access.roleName, policy: access.policy };
}

// ── Administración (solo dueño/administrador del negocio) ───────────────

export function canManageAccess(membershipRole: string) {
  return hasRole(membershipRole, "admin");
}

function assertManager(actor: { role: string }) {
  if (!canManageAccess(actor.role)) throw new Error("forbidden");
}

export async function listRoles(businessId: string): Promise<(RoleDefinition & { id: string | null; memberCount: number })[]> {
  const [rows, members] = await Promise.all([
    prisma.accessRole.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
    prisma.memberAccess.groupBy({ by: ["roleId"], where: { businessId, roleId: { not: null } }, _count: { _all: true } }),
  ]);
  const countByRole = new Map(members.map((m) => [m.roleId, m._count._all]));
  const out: (RoleDefinition & { id: string | null; memberCount: number })[] = [];
  for (const key of Object.keys(SYSTEM_ROLES) as (keyof typeof SYSTEM_ROLES)[]) {
    const row = rows.find((r) => r.key === key);
    const def = row
      ? { key, name: row.name, description: row.description ?? "", system: true, policy: normalizePolicy(row.permissions, SYSTEM_ROLES[key].policy) }
      : SYSTEM_ROLES[key];
    out.push({ ...def, id: row?.id ?? null, memberCount: row ? (countByRole.get(row.id) ?? 0) : 0 });
  }
  for (const row of rows.filter((r) => !isSystemRoleKey(r.key))) {
    out.push({ key: row.key, name: row.name, description: row.description ?? "", system: false, policy: normalizePolicy(row.permissions), id: row.id, memberCount: countByRole.get(row.id) ?? 0 });
  }
  return out;
}

function slugRoleKey(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "rol"
  );
}

/** Crea un rol personalizado o guarda la versión editada de uno (incluidos los del sistema). */
export async function saveRole(
  businessId: string,
  actor: { role: string },
  data: { key?: string | null; name: string; description?: string | null; permissions: unknown }
) {
  assertManager(actor);
  const name = data.name.trim().slice(0, 60);
  if (!name) throw new Error("invalid_input");
  if (data.key) {
    const fallback = isSystemRoleKey(data.key) ? SYSTEM_ROLES[data.key].policy : SYSTEM_ROLES.member.policy;
    const policy = normalizePolicy(data.permissions, fallback);
    const existing = await prisma.accessRole.findFirst({ where: { businessId, key: data.key } });
    if (!existing && !isSystemRoleKey(data.key)) throw new Error("role_not_found");
    return prisma.accessRole.upsert({
      where: { businessId_key: { businessId, key: data.key } },
      create: { businessId, key: data.key, name, description: data.description?.trim() || null, system: isSystemRoleKey(data.key), permissions: policy as unknown as Prisma.InputJsonValue },
      update: { name, description: data.description?.trim() || null, permissions: policy as unknown as Prisma.InputJsonValue },
    });
  }
  const base = slugRoleKey(name);
  let key = base;
  for (let i = 2; isSystemRoleKey(key) || key === "owner" || (await prisma.accessRole.count({ where: { businessId, key } })); i++) key = `${base}_${i}`;
  const policy = normalizePolicy(data.permissions);
  return prisma.accessRole.create({
    data: { businessId, key, name, description: data.description?.trim() || null, system: false, permissions: policy as unknown as Prisma.InputJsonValue },
  });
}

/** Restaura un rol del sistema a sus permisos originales (borra la versión editada). */
export async function resetSystemRole(businessId: string, actor: { role: string }, key: string) {
  assertManager(actor);
  if (!isSystemRoleKey(key)) throw new Error("role_not_found");
  const row = await prisma.accessRole.findFirst({ where: { businessId, key } });
  if (!row) return true;
  // Quien tenía asignado este rol explícitamente vuelve al default por rol de equipo.
  await prisma.$transaction([prisma.memberAccess.updateMany({ where: { businessId, roleId: row.id }, data: { roleId: null } }), prisma.accessRole.delete({ where: { id: row.id } })]);
  return true;
}

export async function deleteRole(businessId: string, actor: { role: string }, key: string) {
  assertManager(actor);
  if (isSystemRoleKey(key)) throw new Error("system_role");
  const row = await prisma.accessRole.findFirst({ where: { businessId, key } });
  if (!row) return false;
  // Sus miembros vuelven al rol por defecto de su rol de equipo (FK SetNull).
  await prisma.accessRole.delete({ where: { id: row.id } });
  return true;
}

/** Fila de rol (creándola para los del sistema si hace falta) para asignarla. */
async function roleIdForKey(businessId: string, key: string): Promise<string | null> {
  const row = await prisma.accessRole.findFirst({ where: { businessId, key }, select: { id: true } });
  if (row) return row.id;
  if (!isSystemRoleKey(key)) throw new Error("role_not_found");
  const def = SYSTEM_ROLES[key];
  const created = await prisma.accessRole.upsert({
    where: { businessId_key: { businessId, key } },
    create: { businessId, key, name: def.name, description: def.description, system: true, permissions: def.policy as unknown as Prisma.InputJsonValue },
    update: {},
    select: { id: true },
  });
  return created.id;
}

export async function listMemberAccess(businessId: string) {
  const [members, rows] = await Promise.all([listWorkspaceMembers(businessId), prisma.memberAccess.findMany({ where: { businessId }, include: { role: { select: { key: true } } } })]);
  return members.map((m) => {
    const row = rows.find((r) => r.userId === m.userId);
    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      membershipRole: m.role,
      roleKey: m.role === "owner" ? "owner" : (row?.role?.key ?? defaultRoleKeyFor(m.role)),
      explicitRole: !!row?.role,
      overrides: normalizeOverrides(row?.overrides),
    };
  });
}

/**
 * Rol de Nodo + excepciones de una persona. El dueño no se edita (siempre
 * tiene todo) y nadie se edita a sí mismo (evita auto-escalarse).
 */
export async function setMemberAccess(
  businessId: string,
  actor: { userId: string; role: string },
  userId: string,
  data: { roleKey?: string | null; overrides?: PolicyOverrides | null }
) {
  assertManager(actor);
  if (userId === actor.userId) throw new Error("cannot_edit_self");
  await assertUserBelongsToBusiness(businessId, userId);
  const membership = await prisma.membership.findFirst({ where: { businessId, userId }, select: { role: true } });
  if (membership?.role === "owner") throw new Error("forbidden");
  // Un administrador no puede tocar a otro administrador (mismo criterio que el equipo).
  if (actor.role !== "owner" && membership?.role === "admin") throw new Error("forbidden");

  const roleId = data.roleKey === undefined ? undefined : data.roleKey ? await roleIdForKey(businessId, data.roleKey) : null;
  const overrides = data.overrides === undefined ? undefined : (normalizeOverrides(data.overrides) as Prisma.InputJsonValue);
  return prisma.memberAccess.upsert({
    where: { businessId_userId: { businessId, userId } },
    create: { businessId, userId, roleId: roleId ?? null, overrides: overrides ?? {} },
    update: { ...(roleId !== undefined ? { roleId } : {}), ...(overrides !== undefined ? { overrides } : {}) },
  });
}

/** Rol de Nodo elegido al invitar (se aplica al aceptar). */
export async function setInvitationAccess(businessId: string, invitationId: string, roleKey: string | null | undefined) {
  if (!roleKey) return;
  await roleIdForKey(businessId, roleKey); // valida que exista
  await prisma.invitationAccess.upsert({ where: { invitationId }, create: { invitationId, businessId, roleKey }, update: { roleKey } });
}

export async function applyInvitationAccess(invitationId: string, userId: string) {
  const pending = await prisma.invitationAccess.findUnique({ where: { invitationId } });
  if (!pending) return;
  try {
    const roleId = await roleIdForKey(pending.businessId, pending.roleKey);
    await prisma.memberAccess.upsert({
      where: { businessId_userId: { businessId: pending.businessId, userId } },
      create: { businessId: pending.businessId, userId, roleId },
      update: { roleId },
    });
  } catch {
    // Rol borrado entre la invitación y la aceptación: queda el default.
  }
  await prisma.invitationAccess.delete({ where: { invitationId } }).catch(() => null);
}

// ── Equipos y jerarquía ─────────────────────────────────────────────────

export async function listTeams(businessId: string) {
  return prisma.team.findMany({
    where: { businessId },
    include: { members: { select: { userId: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

/** true si poner `parentId` como padre de `teamId` crearía un ciclo. */
export function wouldCreateCycle(teams: { id: string; parentId: string | null }[], teamId: string, parentId: string | null) {
  if (!parentId) return false;
  if (parentId === teamId) return true;
  const parentOf = new Map(teams.map((t) => [t.id, t.parentId]));
  const seen = new Set<string>();
  let cursor: string | null | undefined = parentId;
  while (cursor) {
    if (cursor === teamId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

export interface TeamInput {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  leadUserId?: string | null;
  memberIds?: string[];
}

async function validateTeamRefs(businessId: string, data: TeamInput) {
  if (data.parentId) {
    const parent = await prisma.team.findFirst({ where: { id: data.parentId, businessId }, select: { id: true } });
    if (!parent) throw new Error("team_not_found");
  }
  if (data.leadUserId) await assertUserBelongsToBusiness(businessId, data.leadUserId);
  for (const u of data.memberIds ?? []) await assertUserBelongsToBusiness(businessId, u);
}

export async function createTeam(businessId: string, actor: { role: string }, data: TeamInput & { name: string }) {
  assertManager(actor);
  await validateTeamRefs(businessId, data);
  if (await prisma.team.count({ where: { businessId, name: data.name.trim() } })) throw new Error("team_name_taken");
  const memberIds = Array.from(new Set(data.memberIds ?? []));
  return prisma.team.create({
    data: {
      businessId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      parentId: data.parentId ?? null,
      leadUserId: data.leadUserId ?? null,
      members: { create: memberIds.map((userId) => ({ businessId, userId })) },
    },
  });
}

export async function updateTeam(businessId: string, actor: { role: string }, id: string, data: TeamInput) {
  assertManager(actor);
  const team = await prisma.team.findFirst({ where: { id, businessId } });
  if (!team) return null;
  await validateTeamRefs(businessId, data);
  if (data.parentId !== undefined) {
    const all = await prisma.team.findMany({ where: { businessId }, select: { id: true, parentId: true } });
    if (wouldCreateCycle(all, id, data.parentId)) throw new Error("team_cycle");
  }
  if (data.name && data.name.trim() !== team.name && (await prisma.team.count({ where: { businessId, name: data.name.trim() } }))) throw new Error("team_name_taken");
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
        ...(data.leadUserId !== undefined ? { leadUserId: data.leadUserId } : {}),
      },
    }),
  ];
  if (data.memberIds) {
    const memberIds = Array.from(new Set(data.memberIds));
    ops.push(prisma.teamMember.deleteMany({ where: { teamId: id, userId: { notIn: memberIds } } }));
    for (const userId of memberIds) {
      ops.push(prisma.teamMember.upsert({ where: { teamId_userId: { teamId: id, userId } }, create: { businessId, teamId: id, userId }, update: {} }));
    }
  }
  await prisma.$transaction(ops);
  return prisma.team.findFirst({ where: { id }, include: { members: { select: { userId: true } } } });
}

export async function deleteTeam(businessId: string, actor: { role: string }, id: string) {
  assertManager(actor);
  // Los sub-equipos quedan sin padre (FK SetNull); los miembros se desvinculan (Cascade).
  const r = await prisma.team.deleteMany({ where: { id, businessId } });
  return r.count > 0;
}

/** Limpia la pertenencia a equipos y el acceso de quien deja el negocio. */
export async function removeMemberAccessData(businessId: string, userId: string) {
  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { businessId, userId } }),
    prisma.team.updateMany({ where: { businessId, leadUserId: userId }, data: { leadUserId: null } }),
    prisma.memberAccess.deleteMany({ where: { businessId, userId } }),
  ]);
}
