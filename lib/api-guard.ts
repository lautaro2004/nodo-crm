import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { resolveWorkspaceContext, type OkWorkspaceContext } from "@/lib/workspace";
import { hasRole, type Role } from "@/lib/permissions";

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
// `minRole`: acción restringida por rol (ver lib/permissions.ts). Un rol
// insuficiente responde 403 { error: "forbidden" }.
export async function requireWorkspace(options: { minRole?: Role } = {}): Promise<
  { ctx: OkWorkspaceContext; response: null } | { ctx: null; response: NextResponse }
> {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") {
    return {
      ctx: null,
      response: NextResponse.json({ error: ctx.status }, { status: STATUS_BY_ERROR[ctx.status] }),
    };
  }
  if (options.minRole && !hasRole(ctx.role, options.minRole)) {
    return { ctx: null, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ctx, response: null };
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
  file_empty: 400,
  file_required: 400,
  invalid_role_field: 400,
};

export function domainErrorResponse(err: unknown): NextResponse {
  const code = err instanceof Error ? err.message : "";
  const status = DOMAIN_ERROR_STATUS[code];
  if (!status) throw err;
  return NextResponse.json({ error: code }, { status });
}
