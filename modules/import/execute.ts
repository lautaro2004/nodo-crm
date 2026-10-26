import { prisma } from "@/lib/prisma";
import { moduleEntityType } from "@/lib/custom-modules";
import type { FieldValidation } from "@/lib/custom-fields";
import { AutomationRequirementError, emitCreated } from "@/modules/automations/workflow";
import { createCompany } from "@/modules/companies/service";
import { createContact } from "@/modules/contacts/service";
import { createLead } from "@/modules/leads/service";
import { listCustomFieldDefinitions, setCustomFieldValue, type CustomFieldEntityType } from "@/modules/custom-fields/service";
import { getModuleById, listModuleFields } from "@/modules/custom-modules/service";
import {
  IMPORT_MODULE_DEFS,
  customModuleImportDef,
  validateStandardValue,
  type ImportModuleDef,
  validateCustomValue,
  type ImportModule,
} from "@/modules/import/shared";

export interface ImportRowInput {
  standard: Record<string, string>;
  custom: Record<string, string>; // key = CustomFieldDefinition.id
}

export interface ImportRowError {
  row: number; // 1-based, ya contando el encabezado como fila 1 (fila 2 = primer dato)
  messages: string[];
}

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errorCount: number;
  errors: ImportRowError[];
}

// Dedup por módulo (Fase 6). Devuelve el id existente o null. SÓLO usa
// email/teléfono/dominio — nunca el nombre (ambiguo: dos registros
// distintos pueden compartir nombre, y "mergear" por nombre sería el tipo
// de merge agresivo que la fase pide explícitamente evitar). Si la fila
// no trae ninguno de estos identificadores, no hay forma segura de saber
// si ya existe: siempre se crea un registro nuevo (documentado, no
// inventado).
async function findExisting(businessId: string, module: ImportModule, standard: Record<string, string>) {
  if (module === "contact") {
    if (standard.email) {
      const byEmail = await prisma.contact.findFirst({ where: { businessId, email: { equals: standard.email, mode: "insensitive" } } });
      if (byEmail) return byEmail;
    }
    if (standard.phone) {
      const byPhone = await prisma.contact.findFirst({ where: { businessId, phone: standard.phone } });
      if (byPhone) return byPhone;
    }
    return null;
  }
  if (module === "lead") {
    if (standard.email) {
      const byEmail = await prisma.lead.findFirst({ where: { businessId, email: { equals: standard.email, mode: "insensitive" } } });
      if (byEmail) return byEmail;
    }
    if (standard.phone) {
      const byPhone = await prisma.lead.findFirst({ where: { businessId, phone: standard.phone } });
      if (byPhone) return byPhone;
    }
    return null;
  }
  if (standard.domain) {
    const byDomain = await prisma.company.findFirst({ where: { businessId, domain: { equals: standard.domain, mode: "insensitive" } } });
    if (byDomain) return byDomain;
  }
  if (standard.phone) {
    const byPhone = await prisma.company.findFirst({ where: { businessId, phone: standard.phone } });
    if (byPhone) return byPhone;
  }
  return null;
}

// El chequeo de "required" ya corrió en executeImport antes de llegar
// acá (una fila sin `name` termina en `errors`, nunca en createEntity) —
// el cast sólo le informa a TypeScript esa garantía de runtime.
// Los campos personalizados viajan en el alta (customValues): así las
// automatizaciones de "se crea un registro" ya ven esos valores.
async function createEntity(businessId: string, module: ImportModule, standard: Record<string, string> & { name: string }, custom: Record<string, string>, userId: string | null) {
  const customValues = Object.keys(custom).length ? custom : undefined;
  if (module === "contact") return createContact(businessId, { ...standard, customValues }, { actorUserId: userId });
  if (module === "company") return createCompany(businessId, { ...standard, customValues }, { actorUserId: userId });
  // source: "import" (no "manual") — trazable en el historial de dónde vino cada Lead, mismo campo que ya usa la sincronización de Nexo.
  return createLead(businessId, { ...standard, source: "import", customValues }, { actorUserId: userId });
}

async function updateEntity(businessId: string, module: ImportModule, id: string, standard: Record<string, string>) {
  // Sólo pisa los campos presentes en la fila — una celda vacía en el
  // archivo NUNCA borra un valor que ya existía en Nodo (nada de "merge
  // agresivo").
  if (Object.keys(standard).length === 0) return;
  if (module === "contact") await prisma.contact.updateMany({ where: { id, businessId }, data: standard });
  else if (module === "company") await prisma.company.updateMany({ where: { id, businessId }, data: standard });
  else await prisma.lead.updateMany({ where: { id, businessId }, data: standard });
}

interface ImportAdapter {
  moduleDef: ImportModuleDef;
  findExisting(standard: Record<string, string>, custom: Record<string, string>): Promise<{ id: string } | null>;
  create(standard: Record<string, string> & { name: string }, custom: Record<string, string>): Promise<{ id: string }>;
  /** true si `create` ya escribió los campos personalizados. */
  createWritesCustom?: boolean;
  /** Después del alta y de sus campos (eventos de automatización). */
  afterCreate?(id: string): Promise<void>;
  update(id: string, standard: Record<string, string>): Promise<void>;
  /** Campos personalizados que no pueden quedar vacíos al crear. */
  requiredCustom?: { id: string; label: string }[];
}

export async function executeImport(
  businessId: string,
  module: ImportModule,
  rows: ImportRowInput[],
  userId: string | null = null
): Promise<ImportResult> {
  return runImport(businessId, rows, {
    moduleDef: IMPORT_MODULE_DEFS[module],
    findExisting: (standard) => findExisting(businessId, module, standard),
    create: (standard, custom) => createEntity(businessId, module, standard, custom, userId),
    createWritesCustom: true,
    update: (id, standard) => updateEntity(businessId, module, id, standard),
  });
}

// Módulos personalizados: mismo motor (mapeo, validación por fila,
// importación parcial). "Nombre" → CustomRecord.title. Si el módulo tiene
// campo "Código", se usa como identificador: reimportar el mismo archivo
// actualiza esos registros (ej. precios) en vez de duplicarlos. Sin código,
// siempre crea (nunca se deduplica por nombre).
export async function executeCustomModuleImport(
  businessId: string,
  moduleId: string,
  userId: string,
  rows: ImportRowInput[]
): Promise<ImportResult> {
  const mod = await getModuleById(businessId, moduleId);
  if (!mod) throw new Error("module_not_found");
  if (mod.archivedAt) throw new Error("module_archived");
  const fields = await listModuleFields(businessId, moduleId);
  return runImport(businessId, rows, {
    moduleDef: customModuleImportDef(mod),
    requiredCustom: fields.filter((f) => f.required && f.type !== "image" && f.type !== "file" && f.type !== "relation").map((f) => ({ id: f.id, label: f.label })),
    findExisting: async (_standard, custom) => {
      const code = mod.codeFieldId ? custom[mod.codeFieldId] : undefined;
      if (!code) return null;
      const match = await prisma.customFieldValue.findFirst({
        where: { definitionId: mod.codeFieldId!, value: { equals: code, mode: "insensitive" }, definition: { businessId } },
        select: { entityId: true },
      });
      if (!match) return null;
      return prisma.customRecord.findFirst({ where: { id: match.entityId, businessId, moduleId }, select: { id: true } });
    },
    create: (standard) => prisma.customRecord.create({ data: { businessId, moduleId, title: standard.name, createdById: userId }, select: { id: true } }),
    afterCreate: (id) => emitCreated(businessId, moduleEntityType(moduleId), id, userId),
    update: async (id, standard) => {
      await prisma.customRecord.updateMany({
        where: { id, businessId, moduleId },
        data: { ...(standard.name ? { title: standard.name } : {}), updatedAt: new Date() },
      });
    },
  });
}

async function runImport(businessId: string, rows: ImportRowInput[], adapter: ImportAdapter): Promise<ImportResult> {
  const { moduleDef } = adapter;

  // Autoritativo: se relee acá, nunca se confía en type/options/label que
  // pudo haber mandado el cliente para un definitionId (Fase 8).
  // Relación e imagen no se importan desde un archivo (tienen su propio flujo).
  const definitions = (await listCustomFieldDefinitions(businessId, moduleDef.entityType as CustomFieldEntityType)).filter(
    (d) => d.type !== "image" && d.type !== "file" && d.type !== "relation"
  );
  const definitionById = new Map(definitions.map((d) => [d.id, d]));

  let created = 0;
  let updated = 0;
  const errors: ImportRowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const fileRow = i + 2; // fila 1 = encabezado
    const { standard, custom } = rows[i];
    const messages: string[] = [];

    const cleanStandard: Record<string, string> = {};
    for (const field of moduleDef.standardFields) {
      const raw = standard[field.key] ?? "";
      const error = validateStandardValue(field, raw);
      if (error) messages.push(error);
      else if (raw.trim()) cleanStandard[field.key] = raw.trim();
    }

    const cleanCustom: Record<string, string> = {};
    for (const [definitionId, raw] of Object.entries(custom)) {
      const definition = definitionById.get(definitionId);
      if (!definition) {
        // El id no existe (o no es de este negocio/entidad) — nunca se
        // escribe un valor contra un definitionId sin validar.
        messages.push("Uno de los campos personalizados mapeados ya no existe.");
        continue;
      }
      const error = validateCustomValue({ type: definition.type, options: definition.options, label: definition.label, validation: (definition.validation as FieldValidation | null) ?? null }, raw);
      if (error) messages.push(error);
      else if (raw.trim()) cleanCustom[definitionId] = raw.trim();
    }

    if (messages.length > 0) {
      errors.push({ row: fileRow, messages });
      continue;
    }

    try {
      const existing = await adapter.findExisting(cleanStandard, cleanCustom);
      const missing = existing ? [] : (adapter.requiredCustom ?? []).filter((f) => !cleanCustom[f.id]);
      if (missing.length > 0) {
        errors.push({ row: fileRow, messages: missing.map((f) => `Falta "${f.label}"`) });
        continue;
      }
      let entityId: string;
      let customWritten = false;
      let isNew = false;
      if (existing) {
        await adapter.update(existing.id, cleanStandard);
        entityId = existing.id;
        updated++;
      } else if (cleanStandard.name) {
        const created_ = await adapter.create(cleanStandard as Record<string, string> & { name: string }, cleanCustom);
        entityId = created_.id;
        customWritten = !!adapter.createWritesCustom;
        isNew = true;
        created++;
      } else {
        // No debería pasar (name es requerido y ya se validó arriba),
        // pero si algún módulo futuro no tuviera "name" como requerido
        // esto evita un `!` inseguro en vez de crear con un nombre vacío.
        errors.push({ row: fileRow, messages: ['Falta "Nombre"'] });
        continue;
      }
      for (const [definitionId, value] of customWritten ? [] : Object.entries(cleanCustom)) {
        // El registro es de este negocio (recién creado o encontrado por
        // findExisting, ambos scopeados): no hace falta re-chequearlo.
        // setCustomFieldValue normaliza el valor (fechas dd/mm → ISO,
        // "sí" → true, "1.234,5" → 1234.5) igual que el editor del registro.
        await setCustomFieldValue(businessId, definitionId, entityId, value, { skipEntityCheck: true, skipRequired: true });
      }
      if (isNew && adapter.afterCreate) await adapter.afterCreate(entityId);
    } catch (err) {
      if (err instanceof AutomationRequirementError) {
        errors.push({ row: fileRow, messages: [err.requirement.message] });
        continue;
      }
      // Una fila que falla en la escritura (ej. constraint de base) no
      // aborta el resto del archivo — importación parcial, no atómica
      // (Fase 6/7: "150 filas procesadas, 143 creadas, 4 actualizadas, 3
      // con errores" es intrínsecamente un resultado parcial).
      errors.push({ row: fileRow, messages: [err instanceof Error ? err.message : "Error al guardar esta fila."] });
    }
  }

  return { totalRows: rows.length, created, updated, errorCount: errors.length, errors };
}
