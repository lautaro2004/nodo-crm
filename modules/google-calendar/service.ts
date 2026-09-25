import type { GoogleScope } from "@/lib/google/connection";
import { calendarRequest, GoogleCalendarError } from "./client";

// Operaciones sobre el calendario PRINCIPAL ("primary") de la cuenta Google del
// usuario. V1: sin sincronización bidireccional, webhooks, syncToken ni
// calendarios múltiples.

export interface GoogleEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
}

export interface GoogleEventRef {
  id: string;
  htmlLink: string | null;
}

// Evento de Google que Nodo solo LEE (no fue creado por Nodo).
export interface ExternalGoogleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
}

interface RawGoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

// Marca los eventos creados por Nodo: sirve para reconocerlos y no listarlos
// como "externos" (ya se muestran como eventos de Nodo → sin duplicados).
const NODO_MARK = "nodoEventId";

function toBody(input: Partial<GoogleEventInput>, nodoEventId?: string) {
  return {
    ...(input.title !== undefined ? { summary: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? "" } : {}),
    ...(input.location !== undefined ? { location: input.location ?? "" } : {}),
    ...(input.startsAt ? { start: { dateTime: input.startsAt.toISOString() } } : {}),
    ...(input.endsAt ? { end: { dateTime: input.endsAt.toISOString() } } : {}),
    ...(nodoEventId ? { extendedProperties: { private: { [NODO_MARK]: nodoEventId } } } : {}),
  };
}

export async function createGoogleEvent(scope: GoogleScope, input: GoogleEventInput, nodoEventId: string): Promise<GoogleEventRef> {
  const created = await calendarRequest<RawGoogleEvent>(scope, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(toBody(input, nodoEventId)),
  });
  if (!created?.id) throw new GoogleCalendarError("google_error");
  return { id: created.id, htmlLink: created.htmlLink ?? null };
}

export async function updateGoogleEvent(scope: GoogleScope, googleEventId: string, input: Partial<GoogleEventInput>): Promise<void> {
  await calendarRequest(scope, `/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: "PATCH",
    body: JSON.stringify(toBody(input)),
  });
}

// Eliminar un evento que ya no existe en Google (404/410) es un éxito: el
// resultado deseado ya se cumplió.
export async function deleteGoogleEvent(scope: GoogleScope, googleEventId: string): Promise<void> {
  try {
    await calendarRequest(scope, `/calendars/primary/events/${encodeURIComponent(googleEventId)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof GoogleCalendarError && error.code === "not_found") return;
    throw error;
  }
}

// Eventos de Google en el rango, SIN los que ya son de Nodo (los creados por
// Nodo, reconocidos por la marca, y los ya vinculados en la base). `linkedIds`
// son los googleEventId que Nodo ya muestra como propios.
export async function listExternalEvents(
  scope: GoogleScope,
  range: { from: Date; to: Date },
  linkedIds: ReadonlySet<string> = new Set()
): Promise<ExternalGoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: range.from.toISOString(),
    timeMax: range.to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const data = await calendarRequest<{ items?: RawGoogleEvent[] }>(scope, `/calendars/primary/events?${params}`);

  return (data?.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => !linkedIds.has(e.id) && !e.extendedProperties?.private?.[NODO_MARK])
    .map((e) => ({
      id: e.id,
      title: e.summary?.trim() || "(sin título)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      allDay: !e.start?.dateTime,
      location: e.location ?? null,
      htmlLink: e.htmlLink ?? null,
    }))
    .filter((e) => e.start);
}
