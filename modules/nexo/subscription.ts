import { prisma } from "@/lib/prisma";

// ¿El negocio tiene Nexo? = existe su nexo.Subscription (Nexo crea una al
// registrarse el negocio, incluso en el plan base). Única lectura del CRM
// sobre la facturación de Nexo; nunca se escribe.
export async function businessHasNexo(businessId: string): Promise<boolean> {
  const sub = await prisma.nexoSubscription.findUnique({ where: { businessId }, select: { id: true } });
  return !!sub;
}
