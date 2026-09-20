import { NextResponse } from "next/server";

const CLIENT_ERRORS = new Set([
  "invalid_date",
  "invalid_time_range",
  "company_not_found",
  "contact_not_found",
  "lead_not_found",
  "opportunity_not_found",
  "user_not_in_business",
]);

// Errores de validación de dominio -> 400; cualquier otro se re-lanza.
export function calendarErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error && CLIENT_ERRORS.has(err.message)) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  throw err;
}
