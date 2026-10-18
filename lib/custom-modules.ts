// Módulos personalizados — utilidades puras (cliente y servidor).
// El entityType de un módulo personalizado es "cm:<moduleId>": el id es
// estable aunque el módulo se renombre, y el prefijo evita choques con los
// módulos estándar ("lead", "contact", …).

export const CUSTOM_MODULE_PREFIX = "cm:";
export const MAX_CUSTOM_MODULES = 20;
export const MAX_FIELDS_PER_MODULE = 100;
export const RECORDS_PAGE_SIZE = 50;

export function moduleEntityType(moduleId: string): `cm:${string}` {
  return `cm:${moduleId}`;
}

export function isModuleEntityType(entityType: string) {
  return entityType.startsWith(CUSTOM_MODULE_PREFIX) && entityType.length > CUSTOM_MODULE_PREFIX.length;
}

export function moduleIdFromEntityType(entityType: string): string | null {
  return isModuleEntityType(entityType) ? entityType.slice(CUSTOM_MODULE_PREFIX.length) : null;
}

/** "Productos de limpieza" → "productos-de-limpieza" (para la URL). */
export function slugifyModuleKey(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "modulo";
}

// Íconos disponibles (nombres de components/ui/icons). Uno por módulo.
export const MODULE_ICONS = ["box", "tag", "calendar", "home", "file", "wrench", "briefcase", "star"] as const;
export type ModuleIcon = (typeof MODULE_ICONS)[number];

export interface ModuleTemplateField {
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  role?: "price" | "image" | "code";
}

export interface ModuleTemplate {
  id: string;
  labelSingular: string;
  labelPlural: string;
  description: string;
  icon: ModuleIcon;
  fields: ModuleTemplateField[];
}

// Plantillas OPCIONALES para arrancar rápido. Ninguna se crea sola: el
// usuario elige una (o arranca en blanco) y después la edita a su gusto.
export const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    id: "productos",
    labelSingular: "Producto",
    labelPlural: "Productos",
    description: "Catálogo de productos o servicios con precio, para sumarlos a las oportunidades.",
    icon: "box",
    fields: [
      { key: "codigo", label: "Código", type: "text", role: "code" },
      { key: "precio", label: "Precio", type: "currency", role: "price" },
      { key: "descripcion", label: "Descripción", type: "text" },
      { key: "imagen", label: "Imagen", type: "image", role: "image" },
    ],
  },
  {
    id: "citas",
    labelSingular: "Cita",
    labelPlural: "Citas",
    description: "Turnos o visitas vinculados a un contacto.",
    icon: "calendar",
    fields: [
      { key: "fecha", label: "Fecha", type: "datetime", required: true },
      { key: "estado", label: "Estado", type: "select", options: ["Pendiente", "Confirmada", "Realizada", "Cancelada"] },
      { key: "notas", label: "Notas", type: "text" },
    ],
  },
  {
    id: "propiedades",
    labelSingular: "Propiedad",
    labelPlural: "Propiedades",
    description: "Inmuebles con dirección, tipo y precio.",
    icon: "home",
    fields: [
      { key: "direccion", label: "Dirección", type: "text" },
      { key: "tipo", label: "Tipo", type: "select", options: ["Casa", "Departamento", "Local", "Terreno", "Oficina"] },
      { key: "precio", label: "Precio", type: "currency", role: "price" },
      { key: "imagen", label: "Foto", type: "image", role: "image" },
    ],
  },
  {
    id: "contratos",
    labelSingular: "Contrato",
    labelPlural: "Contratos",
    description: "Contratos con fechas de inicio y fin.",
    icon: "file",
    fields: [
      { key: "inicio", label: "Inicio", type: "date" },
      { key: "fin", label: "Fin", type: "date" },
      { key: "monto", label: "Monto", type: "currency", role: "price" },
      { key: "estado", label: "Estado", type: "select", options: ["Borrador", "Vigente", "Vencido"] },
    ],
  },
];

/** Entidades a las que puede apuntar un campo "relation" (además de otros módulos personalizados). */
export const STANDARD_RELATION_TARGETS: { value: string; label: string }[] = [
  { value: "contact", label: "Contactos" },
  { value: "company", label: "Empresas" },
  { value: "opportunity", label: "Oportunidades" },
  { value: "lead", label: "Leads" },
];
