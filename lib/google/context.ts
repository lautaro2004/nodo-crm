import { resolveWorkspaceContext } from "@/lib/workspace";
import type { GoogleScope } from "./connection";

// ESPECÍFICO DE NODO (Nexo tiene su propia versión basada en la sesión de
// Better Auth): usuario + negocio salen de resolveWorkspaceContext(), el único
// punto de verdad multi-tenant del CRM. Nunca desde datos del cliente.

// Pantalla a la que se vuelve tras autorizar (si no se pide otra).
export const GOOGLE_RETURN_TO = "/dashboard/configuracion/integraciones";

export async function resolveGoogleContext(): Promise<GoogleScope | null> {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  return { userId: ctx.userId, businessId: ctx.businessId };
}
