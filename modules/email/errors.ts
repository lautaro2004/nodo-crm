import { NextResponse } from "next/server";

const STATUS: Record<string, number> = {
  entity_not_found: 404,
  template_not_found: 404,
  recipient_missing: 400,
  unresolved_variables: 400,
  template_name_taken: 409,
  email_not_configured: 409,
  provider_unavailable: 409,
};

// Errores de dominio conocidos -> código HTTP; el resto se re-lanza.
export function emailErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error && err.message in STATUS) {
    return NextResponse.json({ error: err.message }, { status: STATUS[err.message] });
  }
  throw err;
}
