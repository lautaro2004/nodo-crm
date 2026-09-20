import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Acepta el cliente global O un cliente de transacción — así
// modules/leads/conversion.ts (Fase 5) puede reusar exactamente esta
// misma validación DENTRO de su transacción atómica, en vez de duplicar
// la lógica (pedido explícito: "reutilizar la lógica de membresías que ya
// implementamos para Tasks"). El resto de los callers (Tasks) no pasan
// nada y siguen usando el cliente global de siempre.
type PrismaOrTx = typeof prisma | Prisma.TransactionClient;

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

// Único punto que resuelve "quiénes son los usuarios de este negocio" —
// vía public.Membership, nunca inventado ni recibido del cliente. Usado
// para el picker de "Responsable" de una tarea (ver
// docs/architecture/crm-fase-tareas.md, "Asignación a usuarios") — hoy en
// la práctica va a devolver casi siempre un solo miembro (no existe
// todavía invitación de equipo, ver Fase 1 de diseño del CRM), pero la
// función ya es correcta para cuando exista más de uno.
export async function listWorkspaceMembers(businessId: string): Promise<WorkspaceMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { businessId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role }));
}

// Validación explícita para cualquier asignación (Task.ownerId, etc.):
// NUNCA confiar en que un userId enviado por el cliente pertenece a este
// negocio — se verifica contra Membership antes de guardar.
export async function assertUserBelongsToBusiness(businessId: string, userId: string, client: PrismaOrTx = prisma): Promise<void> {
  const membership = await client.membership.findFirst({ where: { businessId, userId }, select: { id: true } });
  if (!membership) throw new Error("user_not_in_business");
}
