import { prisma } from "@/lib/prisma";
import { normalizeViewParams } from "@/lib/views/presets";

import { moduleIdFromEntityType } from "@/lib/custom-modules";
import { canAdmin, type AccessPolicy } from "@/lib/access";

export type ViewEntityType = "lead" | "opportunity" | "contact" | "company" | "task" | `cm:${string}`;

// Permisos de vistas:
// - Cualquier miembro crea vistas personales y ve las compartidas.
// - Compartir (o editar/borrar una compartida) requiere el permiso
//   administrativo "Vistas compartidas" (por defecto, owner/admin).
// - Una vista personal solo la ve y la modifica quien la creó.
export function canManageSharedViews(actor: string | Actor) {
  if (typeof actor !== "string" && actor.access) return canAdmin(actor.access.policy, "views");
  const role = typeof actor === "string" ? actor : actor.role;
  return role === "owner" || role === "admin";
}

interface Actor {
  userId: string;
  role: string;
  access?: { policy: AccessPolicy };
}

export async function listViews(businessId: string, entityType: ViewEntityType, actor: Actor) {
  return prisma.savedView.findMany({
    where: { businessId, entityType, OR: [{ shared: true }, { createdBy: actor.userId }] },
    orderBy: [{ shared: "asc" }, { name: "asc" }],
  });
}

export async function createView(
  businessId: string,
  actor: Actor,
  data: { entityType: ViewEntityType; name: string; params: string; shared?: boolean }
) {
  if (data.shared && !canManageSharedViews(actor)) throw new Error("forbidden");
  const moduleId = moduleIdFromEntityType(data.entityType);
  if (moduleId && !(await prisma.customModule.count({ where: { id: moduleId, businessId } }))) throw new Error("module_not_found");
  return prisma.savedView.create({
    data: {
      businessId,
      entityType: data.entityType,
      name: data.name.trim(),
      params: normalizeViewParams(data.params),
      shared: !!data.shared,
      createdBy: actor.userId,
    },
  });
}

async function findEditable(businessId: string, id: string, actor: Actor) {
  const view = await prisma.savedView.findFirst({ where: { id, businessId } });
  if (!view) return null;
  const isMine = view.createdBy === actor.userId;
  if (view.shared ? !canManageSharedViews(actor) : !isMine) throw new Error("forbidden");
  return view;
}

export async function updateView(
  businessId: string,
  id: string,
  actor: Actor,
  data: { name?: string; params?: string; shared?: boolean }
) {
  const view = await findEditable(businessId, id, actor);
  if (!view) return null;
  if (data.shared !== undefined && data.shared !== view.shared && !canManageSharedViews(actor)) throw new Error("forbidden");
  return prisma.savedView.update({
    where: { id: view.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.params !== undefined ? { params: normalizeViewParams(data.params) } : {}),
      ...(data.shared !== undefined ? { shared: data.shared } : {}),
    },
  });
}

export async function deleteView(businessId: string, id: string, actor: Actor) {
  const view = await findEditable(businessId, id, actor);
  if (!view) return false;
  await prisma.savedView.deleteMany({ where: { id: view.id, businessId } });
  return true;
}
