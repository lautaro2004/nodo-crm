import { getAccessToken, GoogleConnectionError, type GoogleScope } from "@/lib/google/connection";

// ÚNICO lugar de Nodo que habla con la API de Google Calendar. El resto del
// código (calendario, tareas) usa modules/google-calendar/service.ts.

const BASE = "https://www.googleapis.com/calendar/v3";

// Códigos estables para que las capas de arriba decidan sin leer mensajes de
// Google (que nunca se exponen tal cual).
export type GoogleCalendarErrorCode =
  | "not_connected" // sin conexión (o sin el permiso de Calendar)
  | "revoked" // Google revocó el acceso: reconectar
  | "not_found" // el evento ya no existe en Google (404/410)
  | "forbidden" // Google rechazó por permisos
  | "google_error"; // cualquier otro fallo (red, 5xx)

export class GoogleCalendarError extends Error {
  constructor(public code: GoogleCalendarErrorCode) {
    super(code);
  }
}

export async function calendarRequest<T>(scope: GoogleScope, path: string, init: RequestInit = {}): Promise<T | null> {
  let token: string;
  try {
    token = await getAccessToken(scope, "calendar");
  } catch (error) {
    if (error instanceof GoogleConnectionError) {
      if (error.code === "revoked") throw new GoogleCalendarError("revoked");
      if (error.code === "not_connected" || error.code === "missing_scope") throw new GoogleCalendarError("not_connected");
    }
    throw new GoogleCalendarError("google_error");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new GoogleCalendarError("google_error");
  }

  if (response.status === 404 || response.status === 410) throw new GoogleCalendarError("not_found");
  if (response.status === 401) throw new GoogleCalendarError("revoked");
  if (response.status === 403) throw new GoogleCalendarError("forbidden");
  if (!response.ok) throw new GoogleCalendarError("google_error");
  if (response.status === 204) return null;
  return (await response.json().catch(() => null)) as T | null;
}
