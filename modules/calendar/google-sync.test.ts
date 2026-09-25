import { beforeEach, describe, expect, it, vi } from "vitest";

// Integración del calendario de Nodo con Google Calendar sobre CalendarEvent:
// provider internal/google, googleEventId, googleUserId. Google está simulado.

const eventCreate = vi.fn();
const eventFindFirst = vi.fn();
const eventUpdate = vi.fn();
const eventDeleteMany = vi.fn();
const membershipFindFirst = vi.fn();
const activityCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendarEvent: {
      create: (...a: unknown[]) => eventCreate(...a),
      findFirst: (...a: unknown[]) => eventFindFirst(...a),
      update: (...a: unknown[]) => eventUpdate(...a),
      deleteMany: (...a: unknown[]) => eventDeleteMany(...a),
    },
    membership: { findFirst: (...a: unknown[]) => membershipFindFirst(...a) },
    activity: { create: (...a: unknown[]) => activityCreate(...a) },
  },
}));

const createGoogleEvent = vi.fn();
const updateGoogleEvent = vi.fn();
const deleteGoogleEvent = vi.fn();
vi.mock("@/modules/google-calendar/service", () => ({
  createGoogleEvent: (...a: unknown[]) => createGoogleEvent(...a),
  updateGoogleEvent: (...a: unknown[]) => updateGoogleEvent(...a),
  deleteGoogleEvent: (...a: unknown[]) => deleteGoogleEvent(...a),
}));

const { GoogleCalendarError } = await import("@/modules/google-calendar/client");
const { createEvent, updateEvent, deleteEvent } = await import("./service");
const { calendarErrorResponse } = await import("./errors");

const BIZ = "biz-a";
const OWNER = "user-a";
const OTHER = "user-b";
const START = "2026-09-25T18:00:00.000Z";
const END = "2026-09-25T19:00:00.000Z";
const base = { title: "Reunión", startsAt: START, endsAt: END };

const internalRow = { id: "evt-1", businessId: BIZ, title: "Reunión", description: null, location: null, type: "meeting", startsAt: new Date(START), endsAt: new Date(END), companyId: null, contactId: null, leadId: null, opportunityId: null, provider: "internal", googleEventId: null, googleUserId: null };
const googleRow = { ...internalRow, provider: "google", googleEventId: "g-1", googleUserId: OWNER };

beforeEach(() => {
  vi.clearAllMocks();
  eventCreate.mockResolvedValue(internalRow);
  eventUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...googleRow, ...data }));
  eventDeleteMany.mockResolvedValue({ count: 1 });
  createGoogleEvent.mockResolvedValue({ id: "g-1", htmlLink: null });
  updateGoogleEvent.mockResolvedValue(undefined);
  deleteGoogleEvent.mockResolvedValue(undefined);
  membershipFindFirst.mockResolvedValue({ id: "m" });
});

describe("crear evento → Google Calendar", () => {
  it("sin syncToGoogle no toca Google (evento interno)", async () => {
    await createEvent(BIZ, base, OWNER);
    expect(createGoogleEvent).not.toHaveBeenCalled();
    expect(eventCreate.mock.calls[0][0].data.provider).toBeUndefined(); // default "internal" en la base
  });

  it("con syncToGoogle crea en el calendario del usuario y guarda googleEventId/provider/googleUserId", async () => {
    eventUpdate.mockResolvedValue({ ...googleRow });
    const event = await createEvent(BIZ, { ...base, syncToGoogle: true }, OWNER);

    expect(createGoogleEvent).toHaveBeenCalledTimes(1);
    const [scope, input, nodoEventId] = createGoogleEvent.mock.calls[0];
    expect(scope).toEqual({ businessId: BIZ, userId: OWNER }); // conexión del propio usuario
    expect(input).toMatchObject({ title: "Reunión" });
    expect(nodoEventId).toBe("evt-1");
    expect(eventUpdate).toHaveBeenCalledWith({ where: { id: "evt-1" }, data: { provider: "google", googleEventId: "g-1", googleUserId: OWNER } });
    expect(event).toMatchObject({ provider: "google", googleEventId: "g-1" });
  });

  it("syncToGoogle no llega a la base como columna", async () => {
    await createEvent(BIZ, { ...base, syncToGoogle: true }, OWNER);
    expect(eventCreate.mock.calls[0][0].data).not.toHaveProperty("syncToGoogle");
  });

  it("si Google falla no queda un evento a medias: se deshace la fila y se informa el error", async () => {
    createGoogleEvent.mockRejectedValue(new GoogleCalendarError("google_error"));
    await expect(createEvent(BIZ, { ...base, syncToGoogle: true }, OWNER)).rejects.toThrow("google_sync_failed");
    expect(eventDeleteMany).toHaveBeenCalledWith({ where: { id: "evt-1", businessId: BIZ } });
  });

  it("sin conexión o sin permiso de Calendar responde google_not_connected (409) y no guarda nada", async () => {
    createGoogleEvent.mockRejectedValue(new GoogleCalendarError("not_connected"));
    const error = await createEvent(BIZ, { ...base, syncToGoogle: true }, OWNER).catch((e) => e);
    expect(error.message).toBe("google_not_connected");
    expect(calendarErrorResponse(error).status).toBe(409);
    expect(eventDeleteMany).toHaveBeenCalled();
  });

  it("acceso revocado: google_needs_reconnect", async () => {
    createGoogleEvent.mockRejectedValue(new GoogleCalendarError("revoked"));
    await expect(createEvent(BIZ, { ...base, syncToGoogle: true }, OWNER)).rejects.toThrow("google_needs_reconnect");
  });

  it("si falla guardar el vínculo se borra el evento recién creado en Google (sin huérfanos ni duplicados)", async () => {
    eventUpdate.mockRejectedValue(new Error("db caída"));
    await expect(createEvent(BIZ, { ...base, syncToGoogle: true }, OWNER)).rejects.toThrow("db caída");
    expect(deleteGoogleEvent).toHaveBeenCalledWith({ businessId: BIZ, userId: OWNER }, "g-1");
    expect(eventDeleteMany).toHaveBeenCalled();
  });

  it("requiere un usuario: no se sincroniza sin quién sea el dueño de la conexión", async () => {
    await expect(createEvent(BIZ, { ...base, syncToGoogle: true }, null)).rejects.toThrow("google_requires_user");
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("guarda el vínculo con la tarea cuando se crea desde una tarea", async () => {
    await createEvent(BIZ, base, OWNER, { taskId: "task-1" });
    expect(eventCreate.mock.calls[0][0].data.taskId).toBe("task-1");
  });
});

describe("editar evento vinculado", () => {
  beforeEach(() => eventFindFirst.mockResolvedValue(googleRow));

  it("aplica título/horario también en Google, con la conexión de su dueño", async () => {
    await updateEvent(BIZ, "evt-1", { title: "Nuevo título", startsAt: START, endsAt: "2026-09-25T20:00:00.000Z" }, OWNER);
    const [scope, googleEventId, input] = updateGoogleEvent.mock.calls[0];
    expect(scope).toEqual({ businessId: BIZ, userId: OWNER });
    expect(googleEventId).toBe("g-1");
    expect(input).toMatchObject({ title: "Nuevo título" });
    expect(input.endsAt.toISOString()).toBe("2026-09-25T20:00:00.000Z");
    expect(eventUpdate.mock.calls[0][0].data).not.toHaveProperty("syncToGoogle");
  });

  it("un cambio que no afecta a Google (estado) no lo llama", async () => {
    await updateEvent(BIZ, "evt-1", { status: "completed" }, OTHER);
    expect(updateGoogleEvent).not.toHaveBeenCalled();
    expect(eventUpdate).toHaveBeenCalled();
  });

  it("otro usuario no puede modificar el evento del Google Calendar de su dueño (403)", async () => {
    const error = await updateEvent(BIZ, "evt-1", { title: "Hack" }, OTHER).catch((e) => e);
    expect(error.message).toBe("google_event_forbidden");
    expect(calendarErrorResponse(error).status).toBe(403);
    expect(updateGoogleEvent).not.toHaveBeenCalled();
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it("si Google falla no se guarda el cambio a medias", async () => {
    updateGoogleEvent.mockRejectedValue(new GoogleCalendarError("google_error"));
    await expect(updateEvent(BIZ, "evt-1", { title: "x" }, OWNER)).rejects.toThrow("google_sync_failed");
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it("con Google desconectado/revocado el cambio se guarda en Nodo (y el evento de Google queda como estaba)", async () => {
    updateGoogleEvent.mockRejectedValue(new GoogleCalendarError("not_connected"));
    await updateEvent(BIZ, "evt-1", { title: "Solo Nodo" }, OWNER);
    expect(eventUpdate.mock.calls[0][0].data).toMatchObject({ title: "Solo Nodo" });
    expect(eventUpdate.mock.calls[0][0].data).not.toHaveProperty("provider");

    updateGoogleEvent.mockRejectedValue(new GoogleCalendarError("revoked"));
    await expect(updateEvent(BIZ, "evt-1", { title: "Otra vez" }, OWNER)).resolves.toBeTruthy();
  });

  it("si el evento fue borrado en Google, se desvincula y queda como evento de Nodo (no se duplica)", async () => {
    updateGoogleEvent.mockRejectedValue(new GoogleCalendarError("not_found"));
    await updateEvent(BIZ, "evt-1", { title: "x" }, OWNER);
    expect(eventUpdate.mock.calls[0][0].data).toMatchObject({ provider: "internal", googleEventId: null, googleUserId: null });
  });

  it("un evento interno se edita sin llamar a Google", async () => {
    eventFindFirst.mockResolvedValue(internalRow);
    await updateEvent(BIZ, "evt-1", { title: "Interno" }, OTHER);
    expect(updateGoogleEvent).not.toHaveBeenCalled();
    expect(eventUpdate).toHaveBeenCalled();
  });

  it("el evento se busca siempre dentro del negocio del usuario", async () => {
    eventFindFirst.mockResolvedValue(null);
    expect(await updateEvent("otro-negocio", "evt-1", { title: "x" }, OWNER)).toBeNull();
    expect(eventFindFirst).toHaveBeenCalledWith({ where: { id: "evt-1", businessId: "otro-negocio" } });
    expect(updateGoogleEvent).not.toHaveBeenCalled();
  });
});

describe("eliminar evento vinculado", () => {
  beforeEach(() => eventFindFirst.mockResolvedValue(googleRow));

  it("lo elimina también en Google y luego en Nodo", async () => {
    expect(await deleteEvent(BIZ, "evt-1", OWNER)).toBe(true);
    expect(deleteGoogleEvent).toHaveBeenCalledWith({ businessId: BIZ, userId: OWNER }, "g-1");
    expect(eventDeleteMany).toHaveBeenCalledWith({ where: { id: "evt-1", businessId: BIZ } });
  });

  it("otro usuario no puede eliminarlo (403) y nada se borra", async () => {
    await expect(deleteEvent(BIZ, "evt-1", OTHER)).rejects.toThrow("google_event_forbidden");
    expect(deleteGoogleEvent).not.toHaveBeenCalled();
    expect(eventDeleteMany).not.toHaveBeenCalled();
  });

  it("si Google falla no se borra el de Nodo", async () => {
    deleteGoogleEvent.mockRejectedValue(new GoogleCalendarError("google_error"));
    await expect(deleteEvent(BIZ, "evt-1", OWNER)).rejects.toThrow("google_sync_failed");
    expect(eventDeleteMany).not.toHaveBeenCalled();
  });

  it("con Google desconectado se borra solo el de Nodo (el de Google queda como estaba)", async () => {
    deleteGoogleEvent.mockRejectedValue(new GoogleCalendarError("not_connected"));
    expect(await deleteEvent(BIZ, "evt-1", OWNER)).toBe(true);
    expect(eventDeleteMany).toHaveBeenCalled();
  });

  it("un evento interno se elimina sin llamar a Google", async () => {
    eventFindFirst.mockResolvedValue(internalRow);
    await deleteEvent(BIZ, "evt-1", OWNER);
    expect(deleteGoogleEvent).not.toHaveBeenCalled();
    expect(eventDeleteMany).toHaveBeenCalled();
  });
});
