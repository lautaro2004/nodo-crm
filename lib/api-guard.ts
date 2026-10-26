import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { resolveWorkspaceContext, type OkWorkspaceContext } from "@/lib/workspace";
import { hasRole, type Role } from "@/lib/permissions";
import type { AdminPermission, ModuleAction } from "@/lib/access";
import { canAdminister, can, canSeeRecord, resolveAccess, type ResolvedAccess } from "@/modules/access/service";
import { loadRecordOwnership } from "@/modules/access/ownership";
import { AutomationRequirementError } from "@/modules/automations/workflow";
import { CustomValuesError } from "@/modules/custom-fields/service";

export type GuardedContext = OkWorkspaceContext & { access: ResolvedAccess };

const STATUS_BY_ERROR = {
  unauthenticated: 401,
  no_business: 409,
  no_workspace: 409,
  no_access: 403,
} as const;

// Envoltorio delgado para Route Handlers: resuelve el Workspace UNA vez,
// nunca deja que la route reciba un businessId del cliente. Toda mutación
// que necesite el negocio actual pasa por acá.
//
// Permisos (todos se validan acá, en el servidor; ver lib/access.ts):
// - `minRole`: rol de EQUIPO (public.Membership.role). Solo para la
//   gestión del equipo y de los permisos.
// - `admin`: permiso administrativo de Nodo (campos, automatizaciones…).
// - `permission`: acción operativa sobre un módulo (ver/crear/editar/
//   eliminar/exportar). El alcance por registro (todos/equipo/propios) se
//   chequea aparte con requireRecordAccess.
// Un permiso insuficiente responde 403 { error: "forbidden" }.
export async function requireWorkspace(
  options: { minRole?: Role; admin?: AdminPermission; permission?: { entity: string; action: ModuleAction } } = {}
): Promise<{ ctx: GuardedContext; response: null } | { ctx: null; response: NextResponse }> {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") {
    return {
      ctx: null,
      response: NextResponse.json({ error: ctx.status }, { status: STATUS_BY_ERROR[ctx.status] }),
    };
  }
  if (options.minRole && !hasRole(ctx.role, options.minRole)) return { ctx: null, response: forbidden() };
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (options.admin && !canAdminister(access, options.admin)) return { ctx: null, response: forbidden() };
  if (options.permission && !can(access, options.permission.entity, options.permission.action)) return { ctx: null, response: forbidden() };
  return { ctx: { ...ctx, access }, response: null };
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

/**
 * Acción sobre UN registro: permiso del módulo + alcance (un vendedor con
 * alcance "propios" no puede editar ni borrar el lead de otro aunque
 * conozca el id). Devuelve una respuesta de error (404 si no existe o no
 * lo puede ver, 403 si lo ve pero no puede hacer esa acción) o null.
 */
export async function requireRecordAccess(ctx: GuardedContext, entityType: string, id: string, action: ModuleAction): Promise<NextResponse | null> {
  const record = await loadRecordOwnership(ctx.businessId, entityType, id);
  if (!record || !canSeeRecord(ctx.access, entityType, record)) return notFound();
  if (!can(ctx.access, entityType, action)) return forbidden();
  return null;
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ data: T; response: null } | { data: null; response: NextResponse }> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "invalid_input", details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data, response: null };
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

// Errores de dominio conocidos (lanzados como `new Error("<código>")` por
// los servicios de modules/*) -> respuesta 4xx con el código, para que la
// UI pueda mostrar un mensaje claro (ver lib/error-messages.ts). Un error
// que no está en esta lista se relanza: sigue siendo un 500 real, nunca se
// disfraza de error de validación.
const DOMAIN_ERROR_STATUS: Record<string, number> = {
  company_not_found: 400,
  contact_not_found: 400,
  pipeline_not_found: 400,
  stage_not_found: 400,
  stage_not_in_pipeline: 400,
  stage_required: 400,
  user_not_in_business: 400,
  invalid_status: 400,
  use_convert_endpoint: 400,
  lead_already_converted: 409,
  status_in_use: 409,
  status_key_taken: 409,
  forbidden: 403,
  already_member: 409,
  email_in_other_business: 409,
  products_required: 400,
  product_not_available: 400,
  invitation_invalid: 404,
  invitation_expired: 410,
  invitation_revoked: 410,
  invitation_accepted: 409,
  invitation_wrong_email: 403,
  invalid_config: 400,
  reason_required: 400,
  invalid_reason: 400,
  pipeline_in_use: 409,
  stage_in_use: 409,
  field_key_taken: 409,
  module_not_found: 404,
  record_not_found: 404,
  too_many_fields: 400,
  too_many_modules: 400,
  relation_target_required: 400,
  invalid_relation: 400,
  required_fields: 400,
  invalid_value: 400,
  module_archived: 409,
  archive_first: 409,
  opportunity_not_found: 404,
  opportunity_closed: 409,
  no_items: 400,
  invalid_image_field: 400,
  file_too_large: 413,
  file_type_not_allowed: 415,
  document_too_large: 413,
  document_type_not_allowed: 415,
  invalid_file_field: 400,
  file_empty: 400,
  file_required: 400,
  invalid_role_field: 400,
  integration_not_found: 404,
  encryption_not_configured: 503,
  too_many_integrations: 400,
  integration_not_connected: 409,
  mapping_required: 400,
  event_not_retryable: 409,
  invalid_input: 400,
  invalid_default: 400,
  invalid_validation: 400,
  invalid_option_rename: 400,
  invalid_option_replacement: 400,
  relation_has_multiple: 409,
  relation_not_exclusive: 409,
  relation_target_taken: 409,
  role_not_found: 404,
  system_role: 400,
  cannot_edit_self: 400,
  team_not_found: 404,
  team_cycle: 400,
  team_name_taken: 409,
  dashboard_not_found: 404,
  too_many_dashboards: 400,
  too_many_widgets: 400,
  lead_not_found: 400,
  field_not_writable: 400,
};

export function domainErrorResponse(err: unknown): NextResponse {
  // Una automatización "antes de guardar" exige campos o impide el cambio:
  // 422 con el detalle, para que la UI pida esos datos y reintente (ver
  // components/automations/automation-prompt.tsx). No se guardó nada.
  if (err instanceof AutomationRequirementError) {
    return NextResponse.json({ error: "automation_required", ...err.requirement }, { status: 422 });
  }
  if (err instanceof CustomValuesError) {
    const first = Object.values(err.fields)[0];
    return NextResponse.json({ error: "invalid_value", message: first, fields: err.fields }, { status: 400 });
  }
  const code = err instanceof Error ? err.message : "";
  const status = DOMAIN_ERROR_STATUS[code];
  if (!status) throw err;
  return NextResponse.json({ error: code }, { status });
}
