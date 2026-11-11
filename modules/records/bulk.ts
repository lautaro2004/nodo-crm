import { isModuleEntityType, moduleIdFromEntityType } from "@/lib/custom-modules";
import { updateLead } from "@/modules/leads/service";
import { updateContact } from "@/modules/contacts/service";
import { updateCompany } from "@/modules/companies/service";
import { updateOpportunity } from "@/modules/opportunities/service";
import { updateRecord } from "@/modules/custom-modules/records";

// Acciones masivas sobre registros (propietario, estado, etapa).
//
// Reutiliza las MISMAS funciones de edición que el PATCH de cada entidad,
// registro por registro: validación de propietario, reglas de estado (motivo
// obligatorio, "convertido" solo por conversión), automatizaciones, historial
// y registro de cambios se comportan exactamente igual que en una edición
// individual. Un error en un registro no deja a los demás a medias.

export const MAX_BULK_UPDATE = 500;

export type BulkEntity = "lead" | "contact" | "company" | "opportunity" | `cm:${string}`;

export function isBulkEntity(value: string): value is BulkEntity {
  return ["lead", "contact", "company", "opportunity"].includes(value) || isModuleEntityType(value);
}

export type BulkPatch =
  | { kind: "owner"; ownerId: string | null }
  | { kind: "status"; status: string; statusReason?: string | null }
  | { kind: "stage"; stageId: string };

/** Qué acciones admite cada tipo de registro. */
export function bulkKindsFor(entityType: BulkEntity): BulkPatch["kind"][] {
  if (entityType === "lead" || entityType === "company") return ["owner", "status"];
  if (entityType === "opportunity") return ["owner", "stage"];
  return ["owner"];
}

export interface BulkUpdateResult {
  updated: string[];
  /** No existían en este negocio. */
  notFound: string[];
  /** Fallaron: el registro no cambió. */
  failed: string[];
  /** Código de dominio del primer error (para explicarlo en pantalla). */
  firstError: string | null;
}

async function applyOne(businessId: string, entityType: BulkEntity, id: string, patch: BulkPatch, actorUserId: string | null): Promise<boolean> {
  switch (entityType) {
    case "lead": {
      if (patch.kind === "owner") return !!(await updateLead(businessId, id, { ownerId: patch.ownerId }, actorUserId));
      if (patch.kind === "status") return !!(await updateLead(businessId, id, { status: patch.status, statusReason: patch.statusReason ?? null }, actorUserId));
      return false;
    }
    case "contact":
      return patch.kind === "owner" ? !!(await updateContact(businessId, id, { ownerId: patch.ownerId }, actorUserId)) : false;
    case "company": {
      if (patch.kind === "owner") return !!(await updateCompany(businessId, id, { ownerId: patch.ownerId }, actorUserId));
      if (patch.kind === "status") return !!(await updateCompany(businessId, id, { status: patch.status }, actorUserId));
      return false;
    }
    case "opportunity": {
      if (patch.kind === "owner") return !!(await updateOpportunity(businessId, id, { ownerId: patch.ownerId }, actorUserId));
      if (patch.kind === "stage") return !!(await updateOpportunity(businessId, id, { stageId: patch.stageId }, actorUserId));
      return false;
    }
    default: {
      const moduleId = moduleIdFromEntityType(entityType);
      if (!moduleId || patch.kind !== "owner") return false;
      return !!(await updateRecord(businessId, moduleId, id, { ownerId: patch.ownerId }, actorUserId));
    }
  }
}

export async function bulkUpdateRecords(
  businessId: string,
  entityType: BulkEntity,
  ids: string[],
  patch: BulkPatch,
  actorUserId: string | null = null
): Promise<BulkUpdateResult> {
  const unique = Array.from(new Set(ids)).slice(0, MAX_BULK_UPDATE);
  const result: BulkUpdateResult = { updated: [], notFound: [], failed: [], firstError: null };
  // De a uno, a propósito (ver comentario del archivo).
  for (const id of unique) {
    try {
      if (await applyOne(businessId, entityType, id, patch, actorUserId)) result.updated.push(id);
      else result.notFound.push(id);
    } catch (error) {
      const code = error instanceof Error ? error.message : "unexpected_error";
      if (!result.firstError) result.firstError = code;
      console.error(`[records/bulk] No se pudo actualizar ${entityType} ${id}:`, code);
      result.failed.push(id);
    }
  }
  return result;
}
