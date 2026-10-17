import { prisma } from "@/lib/prisma";
import { normalizeViewParams } from "@/lib/views/presets";

export type ViewEntityType = "lead" | "opportunity";

// Permisos de vistas:
// - Cualquier miembro crea vistas personales y ve las compartidas.
// - Compartir (o editar/borrar una compartida) requiere rol owner/admin.
// - Una vista personal solo la ve y la modifica quien la creó.
export function canManageSharedViews(role: string) {
  return role === "owner" || role === "admin";
}

interface Actor {
  userId: string;
  role: string;
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
  if (data.shared && !canManageSharedViews(actor.role)) throw new Error("forbidden");
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
  if (view.shared ? !canManageSharedViews(actor.role) : !isMine) throw new Error("forbidden");
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
  if (data.shared !== undefined && data.shared !== view.shared && !canManageSharedViews(actor.role)) throw new Error("forbidden");
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
