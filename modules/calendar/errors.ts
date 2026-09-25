import { NextResponse } from "next/server";

const CLIENT_ERRORS = new Set([
  "invalid_date",
  "invalid_time_range",
  "company_not_found",
  "contact_not_found",
  "lead_not_found",
  "opportunity_not_found",
  "user_not_in_business",
  "task_without_due_date",
]);

// Errores de la integración con Google Calendar -> estado HTTP.
const GOOGLE_ERRORS: Record<string, number> = {
  task_not_found: 404,
  google_requires_user: 400,
  google_event_forbidden: 403, // el evento vive en el Google Calendar de otro usuario
  google_not_connected: 409, // sin conexión o sin permiso de Calendar
  google_needs_reconnect: 409, // Google revocó el acceso
  google_sync_failed: 502,
};

// Errores de validación de dominio -> 400; cualquier otro se re-lanza.
export function calendarErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error && CLIENT_ERRORS.has(err.message)) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof Error && err.message in GOOGLE_ERRORS) {
    return NextResponse.json({ error: err.message }, { status: GOOGLE_ERRORS[err.message] });
  }
  throw err;
}
