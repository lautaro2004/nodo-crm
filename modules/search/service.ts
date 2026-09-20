import { prisma } from "@/lib/prisma";

// Búsqueda básica (Fase 3N) — no es un motor de búsqueda global avanzado
// (sin ranking, sin full-text search de Postgres): el mismo patrón
// `contains`/`insensitive` que ya usa cada módulo por separado, agregado
// acá para las 4 entidades pedidas en un solo request.
export async function globalSearch(businessId: string, query: string, limitPerEntity = 5) {
  const q = query.trim();
  if (!q) return { companies: [], contacts: [], leads: [], opportunities: [], tasks: [] };

  const [companies, contacts, leads, opportunities, tasks] = await Promise.all([
    prisma.company.findMany({
      where: { businessId, name: { contains: q, mode: "insensitive" } },
      take: limitPerEntity,
    }),
    prisma.contact.findMany({
      where: { businessId, OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      take: limitPerEntity,
    }),
    prisma.lead.findMany({
      where: { businessId, name: { contains: q, mode: "insensitive" } },
      take: limitPerEntity,
    }),
    prisma.opportunity.findMany({
      where: { businessId, title: { contains: q, mode: "insensitive" } },
      take: limitPerEntity,
    }),
    // Agregado en la fase de pulido UX — Tareas ya era una entidad de
    // primer nivel (vistas, Kanban, filtros) pero la búsqueda global
    // todavía no la incluía.
    prisma.task.findMany({
      where: { businessId, title: { contains: q, mode: "insensitive" } },
      take: limitPerEntity,
    }),
  ]);

  return { companies, contacts, leads, opportunities, tasks };
}
