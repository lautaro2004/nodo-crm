import { prisma } from "@/lib/prisma";
import type { EmailEntityType, VariableValues } from "./render";

export { TEMPLATE_VARIABLES, renderTemplate, findVariables, escapeHtml, SAMPLE_VALUES } from "./render";
export type { VariableKey, VariableValues, EmailEntityType } from "./render";

export interface EntityEmailContext {
  values: VariableValues;
  recipient: { email: string; name: string } | null;
}

// Resuelve valores y destinatario SIEMPRE dentro del businessId. El
// destinatario nunca lo elige el cliente: Contact/Lead -> su propio email;
// Opportunity -> email de su Contacto.
export async function resolveEntityContext(
  businessId: string,
  entityType: EmailEntityType,
  entityId: string
): Promise<EntityEmailContext | null> {
  if (entityType === "contact") {
    const c = await prisma.contact.findFirst({ where: { id: entityId, businessId }, include: { company: { select: { name: true } } } });
    if (!c) return null;
    return {
      values: { "contact.name": c.name, ...(c.company ? { "company.name": c.company.name } : {}) },
      recipient: c.email ? { email: c.email, name: c.name } : null,
    };
  }
  if (entityType === "lead") {
    const l = await prisma.lead.findFirst({
      where: { id: entityId, businessId },
      include: { company: { select: { name: true } }, convertedContact: { select: { name: true } } },
    });
    if (!l) return null;
    return {
      values: {
        "lead.name": l.name,
        ...(l.company ? { "company.name": l.company.name } : {}),
        ...(l.convertedContact ? { "contact.name": l.convertedContact.name } : {}),
      },
      recipient: l.email ? { email: l.email, name: l.name } : null,
    };
  }
  const o = await prisma.opportunity.findFirst({
    where: { id: entityId, businessId },
    include: { company: { select: { name: true } }, contact: { select: { name: true, email: true } } },
  });
  if (!o) return null;
  return {
    values: {
      "opportunity.name": o.title,
      ...(o.company ? { "company.name": o.company.name } : {}),
      ...(o.contact ? { "contact.name": o.contact.name } : {}),
    },
    recipient: o.contact?.email ? { email: o.contact.email, name: o.contact.name } : null,
  };
}

