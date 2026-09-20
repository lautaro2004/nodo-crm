import { prisma } from "@/lib/prisma";

export interface TemplateInput {
  name: string;
  subject: string;
  bodyHtml: string;
}

export async function listTemplates(businessId: string) {
  return prisma.emailTemplate.findMany({ where: { businessId }, orderBy: { name: "asc" } });
}

export async function getTemplate(businessId: string, id: string) {
  return prisma.emailTemplate.findFirst({ where: { id, businessId } });
}

// El unique (businessId, name) lo garantiza la base; se traduce a un
// error de dominio estable en vez de filtrar el error de Prisma.
async function guardDuplicate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") throw new Error("template_name_taken");
    throw err;
  }
}

export async function createTemplate(businessId: string, input: TemplateInput) {
  return guardDuplicate(() => prisma.emailTemplate.create({ data: { businessId, ...input } }));
}

export async function updateTemplate(businessId: string, id: string, input: Partial<TemplateInput>) {
  const current = await prisma.emailTemplate.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!current) return null;
  return guardDuplicate(() => prisma.emailTemplate.update({ where: { id }, data: input }));
}

export async function deleteTemplate(businessId: string, id: string) {
  const result = await prisma.emailTemplate.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
