import { prisma } from "@/lib/prisma";
import { createCompany } from "@/modules/companies/service";
import { createContact } from "@/modules/contacts/service";
import { createLead } from "@/modules/leads/service";
import { listCustomFieldDefinitions, setCustomFieldValue } from "@/modules/custom-fields/service";
import {
  IMPORT_MODULE_DEFS,
  validateStandardValue,
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
async function createEntity(businessId: string, module: ImportModule, standard: Record<string, string> & { name: string }) {
  if (module === "contact") return createContact(businessId, standard);
  if (module === "company") return createCompany(businessId, standard);
  // source: "import" (no "manual") — trazable en el historial de dónde vino cada Lead, mismo campo que ya usa la sincronización de Nexo.
  return createLead(businessId, { ...standard, source: "import" });
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

export async function executeImport(
  businessId: string,
  module: ImportModule,
  rows: ImportRowInput[]
): Promise<ImportResult> {
  const moduleDef = IMPORT_MODULE_DEFS[module];

  // Autoritativo: se relee acá, nunca se confía en type/options/label que
  // pudo haber mandado el cliente para un definitionId (Fase 8).
  const definitions = await listCustomFieldDefinitions(businessId, moduleDef.entityType);
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
      const error = validateCustomValue({ type: definition.type, options: definition.options, label: definition.label }, raw);
      if (error) messages.push(error);
      else if (raw.trim()) cleanCustom[definitionId] = raw.trim();
    }

    if (messages.length > 0) {
      errors.push({ row: fileRow, messages });
      continue;
    }

    try {
      const existing = await findExisting(businessId, module, cleanStandard);
      let entityId: string;
      if (existing) {
        await updateEntity(businessId, module, existing.id, cleanStandard);
        entityId = existing.id;
        updated++;
      } else if (cleanStandard.name) {
        const created_ = await createEntity(businessId, module, cleanStandard as Record<string, string> & { name: string });
        entityId = created_.id;
        created++;
      } else {
        // No debería pasar (name es requerido y ya se validó arriba),
        // pero si algún módulo futuro no tuviera "name" como requerido
        // esto evita un `!` inseguro en vez de crear con un nombre vacío.
        errors.push({ row: fileRow, messages: ['Falta "Nombre"'] });
        continue;
      }
      for (const [definitionId, value] of Object.entries(cleanCustom)) {
        await setCustomFieldValue(businessId, definitionId, entityId, value);
      }
    } catch (err) {
      // Una fila que falla en la escritura (ej. constraint de base) no
      // aborta el resto del archivo — importación parcial, no atómica
      // (Fase 6/7: "150 filas procesadas, 143 creadas, 4 actualizadas, 3
      // con errores" es intrínsecamente un resultado parcial).
      errors.push({ row: fileRow, messages: [err instanceof Error ? err.message : "Error al guardar esta fila."] });
    }
  }

  return { totalRows: rows.length, created, updated, errorCount: errors.length, errors };
}
