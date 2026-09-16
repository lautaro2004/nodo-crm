import { prisma } from "@/lib/prisma";

// Mismo patrón que nexo/modules/business/membership.ts::ensureOwnerMembership
// — idempotente ("si ya tenés una, te devuelvo esa"), nunca crea una
// segunda Membership para el mismo usuario. A diferencia de Nexo, acá NO
// se crea ninguna Subscription (el billing del CRM todavía no existe como
// modelo en esta fase — ver docs/architecture/crm-fase2-bootstrap.md,
// sección "Billing"). Business/Membership son las mismas tablas
// compartidas que ya usa Nexo (public.*) — esto puede crear una fila de
// Business nueva si un usuario arranca directamente desde el CRM sin
// haber pasado nunca por Nexo.
export async function ensureBusinessMembership(userId: string, businessName: string): Promise<string> {
  const existing = await prisma.membership.findFirst({ where: { userId } });
  if (existing) return existing.businessId;

  const business = await prisma.business.create({ data: { name: businessName } });
  await prisma.membership.create({ data: { userId, businessId: business.id, role: "owner" } });

  return business.id;
}
