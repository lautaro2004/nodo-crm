import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cliente/servicio de Google Calendar: se simula el token (conexión) y la red.

const getAccessToken = vi.fn();
vi.mock("@/lib/google/connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/connection")>()),
  getAccessToken: (...a: unknown[]) => getAccessToken(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { GoogleConnectionError } = await import("@/lib/google/connection");
const { GoogleCalendarError } = await import("./client");
const { listExternalEvents, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } = await import("./service");

const SCOPE = { businessId: "biz-a", userId: "user-a" };
const res = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  getAccessToken.mockReset();
  getAccessToken.mockResolvedValue("at-secreto");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-10-01T00:00:00Z") };

describe("listar eventos", () => {
  it("pide solo el permiso de Calendar y usa el calendario principal en el rango", async () => {
    fetchMock.mockResolvedValue(res({ items: [] }));
    await listExternalEvents(SCOPE, range);

    expect(getAccessToken).toHaveBeenCalledWith(SCOPE, "calendar");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://www.googleapis.com/calendar/v3/calendars/primary/events?");
    expect(url).toContain("singleEvents=true");
    expect(url).toContain(`timeMin=${encodeURIComponent(range.from.toISOString())}`);
    expect(init.headers.Authorization).toBe("Bearer at-secreto");
  });

  it("distingue eventos externos: excluye cancelados, los de Nodo y los ya vinculados", async () => {
    fetchMock.mockResolvedValue(
      res({
        items: [
          { id: "ext-1", summary: "Reunión externa", start: { dateTime: "2026-09-25T15:00:00Z" }, end: { dateTime: "2026-09-25T16:00:00Z" }, htmlLink: "https://cal/1" },
          { id: "ext-2", summary: "Cumple", start: { date: "2026-09-26" }, end: { date: "2026-09-27" } },
          { id: "cancelado", status: "cancelled", summary: "x", start: { dateTime: "2026-09-25T15:00:00Z" } },
          { id: "de-nodo", summary: "Creado en Nodo", start: { dateTime: "2026-09-25T15:00:00Z" }, extendedProperties: { private: { nodoEventId: "evt-9" } } },
          { id: "vinculado", summary: "Ya en Nodo", start: { dateTime: "2026-09-25T15:00:00Z" } },
          { id: "sin-fecha", summary: "sin fecha" },
        ],
      })
    );

    const events = await listExternalEvents(SCOPE, range, new Set(["vinculado"]));
    expect(events.map((e) => e.id)).toEqual(["ext-1", "ext-2"]);
    expect(events[0]).toMatchObject({ title: "Reunión externa", allDay: false, htmlLink: "https://cal/1" });
    expect(events[1]).toMatchObject({ allDay: true });
  });

  it("sin conexión (o sin el permiso de Calendar) falla con not_connected y no llama a Google", async () => {
    getAccessToken.mockRejectedValue(new GoogleConnectionError("not_connected"));
    await expect(listExternalEvents(SCOPE, range)).rejects.toMatchObject({ code: "not_connected" });
    getAccessToken.mockRejectedValue(new GoogleConnectionError("missing_scope"));
    await expect(listExternalEvents(SCOPE, range)).rejects.toMatchObject({ code: "not_connected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acceso revocado: revoked; 401/403/5xx/red se traducen a códigos estables", async () => {
    getAccessToken.mockRejectedValue(new GoogleConnectionError("revoked"));
    await expect(listExternalEvents(SCOPE, range)).rejects.toMatchObject({ code: "revoked" });

    getAccessToken.mockResolvedValue("at");
    fetchMock.mockResolvedValue(res({}, 401));
    await expect(listExternalEvents(SCOPE, range)).rejects.toMatchObject({ code: "revoked" });
    fetchMock.mockResolvedValue(res({}, 403));
    await expect(listExternalEvents(SCOPE, range)).rejects.toMatchObject({ code: "forbidden" });
    fetchMock.mockResolvedValue(res({}, 500));
    await expect(listExternalEvents(SCOPE, range)).rejects.toMatchObject({ code: "google_error" });
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(listExternalEvents(SCOPE, range)).rejects.toBeInstanceOf(GoogleCalendarError);
  });

  it("los errores no exponen el token de acceso", async () => {
    fetchMock.mockResolvedValue(res({ error: { message: "at-secreto inválido" } }, 500));
    const error = await listExternalEvents(SCOPE, range).catch((e) => e);
    expect(JSON.stringify([error.message, error.code])).not.toContain("at-secreto");
  });
});

describe("crear, editar y eliminar", () => {
  it("crea un evento marcado con el id de Nodo y devuelve el googleEventId", async () => {
    fetchMock.mockResolvedValue(res({ id: "g-123", htmlLink: "https://cal/g-123" }));
    const ref = await createGoogleEvent(
      SCOPE,
      { title: "Llamar a Martín", description: "Seguimiento", location: "Oficina", startsAt: new Date("2026-09-25T17:00:00Z"), endsAt: new Date("2026-09-25T17:30:00Z") },
      "evt-1"
    );

    expect(ref).toEqual({ id: "g-123", htmlLink: "https://cal/g-123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      summary: "Llamar a Martín",
      description: "Seguimiento",
      location: "Oficina",
      start: { dateTime: "2026-09-25T17:00:00.000Z" },
      end: { dateTime: "2026-09-25T17:30:00.000Z" },
      extendedProperties: { private: { nodoEventId: "evt-1" } },
    });
  });

  it("falla si Google no devuelve un id", async () => {
    fetchMock.mockResolvedValue(res({}));
    await expect(createGoogleEvent(SCOPE, { title: "x", startsAt: new Date(), endsAt: new Date() }, "e")).rejects.toMatchObject({ code: "google_error" });
  });

  it("edita solo los campos indicados (PATCH)", async () => {
    fetchMock.mockResolvedValue(res({}));
    await updateGoogleEvent(SCOPE, "g/123", { title: "Nuevo título" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events/g%2F123");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ summary: "Nuevo título" });
  });

  it("editar un evento que ya no existe en Google informa not_found", async () => {
    fetchMock.mockResolvedValue(res({}, 404));
    await expect(updateGoogleEvent(SCOPE, "g1", { title: "x" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("elimina el evento; si ya no existe (404/410) se considera hecho", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await deleteGoogleEvent(SCOPE, "g1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");

    fetchMock.mockResolvedValue(res({}, 410));
    await expect(deleteGoogleEvent(SCOPE, "g1")).resolves.toBeUndefined();
    fetchMock.mockResolvedValue(res({}, 500));
    await expect(deleteGoogleEvent(SCOPE, "g1")).rejects.toMatchObject({ code: "google_error" });
  });

  it("conexión inexistente: no se puede crear ni editar ni eliminar", async () => {
    getAccessToken.mockRejectedValue(new GoogleConnectionError("not_connected"));
    await expect(createGoogleEvent(SCOPE, { title: "x", startsAt: new Date(), endsAt: new Date() }, "e")).rejects.toMatchObject({ code: "not_connected" });
    await expect(updateGoogleEvent(SCOPE, "g", { title: "x" })).rejects.toMatchObject({ code: "not_connected" });
    await expect(deleteGoogleEvent(SCOPE, "g")).rejects.toMatchObject({ code: "not_connected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
