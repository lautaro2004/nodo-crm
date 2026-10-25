// Permisos de Nodo — modelo puro (cliente y servidor).
//
// Dos niveles, separados a propósito:
// - Operativos, POR MÓDULO: ver / crear / editar / eliminar / exportar
//   registros, más el ALCANCE de lo que se ve (todos, los del equipo o
//   solo los propios). La clave del módulo es su entityType ("lead",
//   "contact", "cm:<id>", …); "*" es el valor para cualquier módulo no
//   listado (incluye los módulos personalizados que se creen después).
// - Administrativos: configurar campos y módulos, vistas compartidas,
//   automatizaciones, paneles compartidos, importar y el resto de la
//   configuración (pipelines, estados, etiquetas, email, integraciones).
//
// La gestión del EQUIPO (invitar, cambiar rol de equipo, quitar miembros,
// equipos y permisos) sigue siendo de dueño/administrador del negocio
// (public.Membership.role, compartido con Nexo) — no es delegable acá
// para que nadie pueda darse más permisos a sí mismo.
//
// Un rol define los permisos por defecto; cada persona puede tener
// excepciones puntuales (ej. "este vendedor sí puede eliminar leads") sin
// cambiar su rol. El dueño del negocio siempre tiene todo.
//
// TODO se valida en el servidor (lib/api-guard.ts, modules/access). Lo que
// la UI oculta es solo comodidad.

export const MODULE_ACTIONS = ["view", "create", "edit", "delete", "export"] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

export const MODULE_ACTION_LABELS: Record<ModuleAction, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
};

export const RECORD_SCOPES = ["all", "team", "own"] as const;
export type RecordScope = (typeof RECORD_SCOPES)[number];
export const RECORD_SCOPE_LABELS: Record<RecordScope, string> = {
  all: "Todos los registros",
  team: "Los de su equipo",
  own: "Solo los propios",
};

export const ADMIN_PERMISSIONS = ["fields", "views", "automations", "reports", "import", "settings"] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, { label: string; hint: string }> = {
  fields: { label: "Campos y módulos", hint: "Crear y editar campos personalizados y módulos." },
  views: { label: "Vistas compartidas", hint: "Crear, editar y borrar vistas para todo el equipo." },
  automations: { label: "Automatizaciones", hint: "Crear, editar, activar y borrar automatizaciones." },
  reports: { label: "Paneles compartidos", hint: "Crear y editar paneles de Informes compartidos." },
  import: { label: "Importar", hint: "Importar registros desde archivos." },
  settings: { label: "Configuración general", hint: "Pipelines, estados, etiquetas, email e integraciones." },
};

/** Pseudo-módulos con permisos operativos además de los módulos de registros. */
export const PSEUDO_MODULES = [{ key: "calendar", label: "Calendario" }] as const;

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  scope: RecordScope;
}

export interface AccessPolicy {
  modules: Record<string, ModulePermission>;
  admin: Record<AdminPermission, boolean>;
}

export interface PolicyOverrides {
  modules?: Record<string, Partial<ModulePermission>>;
  admin?: Partial<Record<AdminPermission, boolean>>;
}

const allAdmin = (v: boolean) => Object.fromEntries(ADMIN_PERMISSIONS.map((p) => [p, v])) as Record<AdminPermission, boolean>;

const FULL: ModulePermission = { view: true, create: true, edit: true, delete: true, export: true, scope: "all" };
const OPERATOR: ModulePermission = { view: true, create: true, edit: true, delete: false, export: true, scope: "all" };
const READ_ONLY: ModulePermission = { view: true, create: false, edit: false, delete: false, export: false, scope: "all" };
const NONE: ModulePermission = { view: false, create: false, edit: false, delete: false, export: false, scope: "own" };

export const SYSTEM_ROLE_KEYS = ["admin", "member", "viewer"] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  system: boolean;
  policy: AccessPolicy;
}

// Defaults de los roles del sistema. Reproducen el comportamiento previo:
// admin = todo; member = opera todo pero no elimina ni configura (como
// antes); viewer = nuevo, solo lectura (por ejemplo, un usuario externo).
export const SYSTEM_ROLES: Record<SystemRoleKey, RoleDefinition> = {
  admin: {
    key: "admin",
    name: "Administrador",
    description: "Todo: registros, configuración, automatizaciones e informes.",
    system: true,
    policy: { modules: { "*": FULL }, admin: allAdmin(true) },
  },
  member: {
    key: "member",
    name: "Miembro",
    description: "Ve, crea y edita registros. No elimina ni configura.",
    system: true,
    policy: { modules: { "*": OPERATOR }, admin: allAdmin(false) },
  },
  viewer: {
    key: "viewer",
    name: "Solo lectura",
    description: "Solo consulta registros e informes. Ideal para usuarios externos.",
    system: true,
    policy: { modules: { "*": READ_ONLY }, admin: allAdmin(false) },
  },
};

export const OWNER_POLICY: AccessPolicy = { modules: { "*": FULL }, admin: allAdmin(true) };

export function isSystemRoleKey(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key);
}

/** Rol de Nodo por defecto según el rol de equipo (Membership.role). */
export function defaultRoleKeyFor(membershipRole: string): SystemRoleKey {
  return membershipRole === "owner" || membershipRole === "admin" ? "admin" : "member";
}

function bool(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

function cleanModulePermission(input: Partial<ModulePermission> | undefined, base: ModulePermission): ModulePermission {
  const p = input ?? {};
  const out: ModulePermission = {
    view: bool(p.view, base.view),
    create: bool(p.create, base.create),
    edit: bool(p.edit, base.edit),
    delete: bool(p.delete, base.delete),
    export: bool(p.export, base.export),
    scope: p.scope && (RECORD_SCOPES as readonly string[]).includes(p.scope) ? p.scope : base.scope,
  };
  // Sin "ver" no hay ninguna otra acción posible (no se puede editar ni
  // exportar lo que no se ve).
  if (!out.view) return { ...NONE, scope: out.scope };
  return out;
}

/** Normaliza un JSON guardado (o recibido) a una política completa y coherente. */
export function normalizePolicy(input: unknown, fallback: AccessPolicy = SYSTEM_ROLES.member.policy): AccessPolicy {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<AccessPolicy>;
  const baseDefault = fallback.modules["*"] ?? OPERATOR;
  const defaultPerm = cleanModulePermission(raw.modules?.["*"], baseDefault);
  const modules: Record<string, ModulePermission> = { "*": defaultPerm };
  for (const [key, value] of Object.entries(raw.modules ?? {})) {
    if (key === "*" || !/^[a-z][a-z0-9:_-]{0,60}$/i.test(key)) continue;
    modules[key] = cleanModulePermission(value, defaultPerm);
  }
  const admin = { ...fallback.admin };
  for (const p of ADMIN_PERMISSIONS) admin[p] = bool(raw.admin?.[p], fallback.admin[p]);
  return { modules, admin };
}

/** Aplica las excepciones de una persona sobre la política de su rol. */
export function applyOverrides(policy: AccessPolicy, overrides: PolicyOverrides | null | undefined): AccessPolicy {
  if (!overrides) return policy;
  const modules = { ...policy.modules };
  for (const [key, value] of Object.entries(overrides.modules ?? {})) {
    if (!value) continue;
    const base = policy.modules[key] ?? policy.modules["*"];
    modules[key] = cleanModulePermission({ ...base, ...value }, base);
  }
  const admin = { ...policy.admin };
  for (const p of ADMIN_PERMISSIONS) if (typeof overrides.admin?.[p] === "boolean") admin[p] = overrides.admin[p]!;
  return { modules, admin };
}

/** Limpia overrides recibidos del cliente (solo claves válidas). */
export function normalizeOverrides(input: unknown): PolicyOverrides {
  const raw = (input && typeof input === "object" ? input : {}) as PolicyOverrides;
  const out: PolicyOverrides = {};
  for (const [key, value] of Object.entries(raw.modules ?? {})) {
    if (!value || typeof value !== "object" || !/^[a-z*][a-z0-9:_-]{0,60}$/i.test(key)) continue;
    const clean: Partial<ModulePermission> = {};
    for (const a of MODULE_ACTIONS) if (typeof value[a] === "boolean") clean[a] = value[a];
    if (value.scope && (RECORD_SCOPES as readonly string[]).includes(value.scope)) clean.scope = value.scope;
    if (Object.keys(clean).length) (out.modules ??= {})[key] = clean;
  }
  for (const p of ADMIN_PERMISSIONS) {
    const v = raw.admin?.[p];
    if (typeof v === "boolean") (out.admin ??= {})[p] = v;
  }
  return out;
}

export function modulePermission(policy: AccessPolicy, entityType: string): ModulePermission {
  return policy.modules[entityType] ?? policy.modules["*"] ?? NONE;
}

export function canDo(policy: AccessPolicy, entityType: string, action: ModuleAction): boolean {
  return modulePermission(policy, entityType)[action];
}

export function canAdmin(policy: AccessPolicy, permission: AdminPermission): boolean {
  return !!policy.admin[permission];
}

/** Lo que el cliente necesita para ocultar/mostrar acciones (nunca decide nada). */
export interface ClientAccess {
  isOwner: boolean;
  roleKey: string;
  roleName: string;
  policy: AccessPolicy;
}
