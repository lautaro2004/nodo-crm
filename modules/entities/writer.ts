import { moduleIdFromEntityType } from "@/lib/custom-modules";
import { CUSTOM_RECORD_FIELDS, STANDARD_FIELDS, definitionIdFromFieldKey, isStandardEntityType, type FieldMeta } from "@/lib/entities";
import { toNumber } from "@/lib/custom-fields";
import type { FieldValue } from "@/modules/entities/registry";

// Escritura genérica de campos (clave de campo → valor) para cualquier
// módulo. Solo la usan las automatizaciones. SIEMPRE pasa por el servicio
// de dominio del módulo: mismas validaciones, historial y eventos que una
// edición desde la UI (por eso una acción puede encadenar otras reglas).

const asText = (v: FieldValue) => (Array.isArray(v) ? v.join(", ") : v);
const asIds = (v: FieldValue) => (Array.isArray(v) ? v.join(",") : v);

function convertStandard(meta: FieldMeta, v: FieldValue): unknown {
  if (meta.type === "relation") return (Array.isArray(v) ? v[0] : v) || null;
  if (meta.type === "number" || meta.type === "currency") {
    const n = v === null ? null : toNumber(String(asText(v)));
    if (v !== null && n === null) throw new Error("invalid_value");
    return n;
  }
  if (meta.type === "user") return (Array.isArray(v) ? v[0] : v) || null;
  return asText(v);
}

export async function writeFields(businessId: string, entityType: string, id: string, changes: Record<string, FieldValue>, actorUserId: string | null) {
  const standardMeta = new Map((isStandardEntityType(entityType) ? STANDARD_FIELDS[entityType] : CUSTOM_RECORD_FIELDS).map((f) => [f.key, f]));
  const standard: Record<string, unknown> = {};
  const custom: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(changes)) {
    const defId = definitionIdFromFieldKey(key);
    if (defId) {
      custom[defId] = (Array.isArray(value) ? asIds(value) : value) ?? null;
      continue;
    }
    const meta = standardMeta.get(key);
    if (!meta || !meta.writable) throw new Error("field_not_writable");
    standard[key] = convertStandard(meta, value);
  }
  const customValues = Object.keys(custom).length ? custom : undefined;

  switch (entityType) {
    case "lead": {
      const { updateLead } = await import("@/modules/leads/service");
      if (standard.name === null) throw new Error("required_fields");
      return updateLead(businessId, id, { ...standard, customValues } as never, actorUserId);
    }
    case "contact": {
      const { updateContact } = await import("@/modules/contacts/service");
      return updateContact(businessId, id, { ...standard, customValues } as never, actorUserId);
    }
    case "company": {
      const { updateCompany } = await import("@/modules/companies/service");
      return updateCompany(businessId, id, { ...standard, customValues } as never, actorUserId);
    }
    case "opportunity": {
      const { updateOpportunity } = await import("@/modules/opportunities/service");
      return updateOpportunity(businessId, id, { ...standard, customValues } as never, actorUserId);
    }
    case "task": {
      const { updateTask } = await import("@/modules/tasks/service");
      return updateTask(businessId, id, { ...standard, customValues } as never, actorUserId);
    }
    default: {
      const moduleId = moduleIdFromEntityType(entityType);
      if (!moduleId) throw new Error("module_not_found");
      const { updateRecord } = await import("@/modules/custom-modules/records");
      return updateRecord(
        businessId,
        moduleId,
        id,
        {
          ...(standard.title !== undefined ? { title: String(standard.title ?? "") } : {}),
          ...(standard.ownerId !== undefined ? { ownerId: (standard.ownerId as string | null) ?? null } : {}),
          ...(customValues ? { values: customValues } : {}),
        },
        actorUserId
      );
    }
  }
}
