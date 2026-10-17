// Roles del equipo (compartidos con Nexo: public.Membership.role).
//   owner  — todo, incluido el equipo completo y (en Nexo) la facturación.
//   admin  — configuración del CRM, automatizaciones y equipo (miembros).
//   member — operación diaria: leads, oportunidades, empresas, contactos,
//            tareas, calendario. No configura, no importa, no borra.
export type Role = "owner" | "admin" | "member";
export const ROLES: Role[] = ["owner", "admin", "member"];

export const ROLE_LABELS: Record<Role, string> = { owner: "Dueño", admin: "Administrador", member: "Miembro" };
export const ROLE_HINTS: Record<Role, string> = {
  owner: "Todo, incluida la facturación de Nexo.",
  admin: "Configura Nodo, automatizaciones y gestiona miembros.",
  member: "Trabaja con leads, oportunidades, tareas y calendario.",
};

const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export function normalizeRole(role: string | null | undefined): Role {
  return role === "owner" || role === "admin" ? role : "member";
}

export function hasRole(role: string | null | undefined, minRole: Role): boolean {
  return RANK[normalizeRole(role)] >= RANK[minRole];
}

/** Un actor solo gestiona a quien tiene un rol MENOR que el suyo. */
export function canManage(actorRole: string, targetRole: string): boolean {
  return RANK[normalizeRole(actorRole)] > RANK[normalizeRole(targetRole)];
}

/** Roles que un actor puede asignar (siempre por debajo del suyo; nunca owner). */
export function assignableRoles(actorRole: string): Role[] {
  return (["admin", "member"] as Role[]).filter((r) => RANK[r] < RANK[normalizeRole(actorRole)]);
}

// Productos del ecosistema Kodexa que comparten identidad y equipo.
export const PRODUCTS = ["crm", "nexo"] as const;
export type Product = (typeof PRODUCTS)[number];
export const PRODUCT_LABELS: Record<Product, string> = { crm: "Nodo (CRM)", nexo: "Nexo" };
