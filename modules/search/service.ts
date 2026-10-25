import { prisma } from "@/lib/prisma";
import { can, canSeeRecord, scopeWhere, type ResolvedAccess } from "@/modules/access/service";

// Búsqueda básica (Fase 3N) — no es un motor de búsqueda global avanzado
// (sin ranking, sin full-text search de Postgres): el mismo patrón
// `contains`/`insensitive` que ya usa cada módulo por separado, agregado
// acá para las 4 entidades pedidas en un solo request.
// Con `access`, cada módulo respeta el permiso "Ver" y el alcance de la
// persona (todos / equipo / propios): nunca devuelve registros que no
// podría abrir.
export async function globalSearch(businessId: string, query: string, limitPerEntity = 5, access?: ResolvedAccess) {
  const q = query.trim();
  if (!q) return { companies: [], contacts: [], leads: [], opportunities: [], tasks: [], records: [] };
  const allowed = (entity: string) => !access || can(access, entity, "view");
  const scope = (entity: string, createdByField?: string) => (access ? scopeWhere(access, entity, { createdByField }) : {});
  const none = Promise.resolve([] as never[]);

  const [companies, contacts, leads, opportunities, tasks, rawRecords] = await Promise.all([
    allowed("company")
      ? prisma.company.findMany({ where: { businessId, AND: [scope("company")], name: { contains: q, mode: "insensitive" } }, take: limitPerEntity })
      : none,
    allowed("contact")
      ? prisma.contact.findMany({
          where: { businessId, AND: [scope("contact")], OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
          take: limitPerEntity,
        })
      : none,
    allowed("lead") ? prisma.lead.findMany({ where: { businessId, AND: [scope("lead")], name: { contains: q, mode: "insensitive" } }, take: limitPerEntity }) : none,
    allowed("opportunity")
      ? prisma.opportunity.findMany({ where: { businessId, AND: [scope("opportunity")], title: { contains: q, mode: "insensitive" } }, take: limitPerEntity })
      : none,
    // Agregado en la fase de pulido UX — Tareas ya era una entidad de
    // primer nivel (vistas, Kanban, filtros) pero la búsqueda global
    // todavía no la incluía.
    allowed("task")
      ? prisma.task.findMany({ where: { businessId, AND: [scope("task", "createdById")], title: { contains: q, mode: "insensitive" } }, take: limitPerEntity })
      : none,
    // Registros de módulos personalizados (activos, de módulos no archivados).
    prisma.customRecord.findMany({
      where: { businessId, archivedAt: null, module: { archivedAt: null }, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, moduleId: true, ownerId: true, createdById: true, module: { select: { key: true, labelPlural: true } } },
      take: limitPerEntity * 4,
    }),
  ]);
  const records = rawRecords
    .filter((r) => !access || canSeeRecord(access, `cm:${r.moduleId}`, r))
    .slice(0, limitPerEntity * 2)
    .map((r) => ({ id: r.id, title: r.title, module: r.module }));

  return { companies, contacts, leads, opportunities, tasks, records };
}
