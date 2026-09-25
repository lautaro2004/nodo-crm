import { beforeEach, describe, expect, it, vi } from "vitest";

const taskFindFirst = vi.fn();
const eventFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findFirst: (...a: unknown[]) => taskFindFirst(...a) },
    calendarEvent: { findFirst: (...a: unknown[]) => eventFindFirst(...a) },
  },
}));

const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
vi.mock("@/modules/calendar/service", () => ({
  createEvent: (...a: unknown[]) => createEvent(...a),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  deleteEvent: (...a: unknown[]) => deleteEvent(...a),
}));

const { addTaskToGoogleCalendar, removeTaskFromGoogleCalendar, getTaskGoogleLink } = await import("./google-calendar");

const BIZ = "biz-a";
const USER = "user-a";
const DUE = new Date("2026-09-24T17:00:00.000Z"); // 24/09/2026 14:00 (Argentina)
const task = { id: "task-1", businessId: BIZ, title: "Contactar a Martín", description: "Llamar por el presupuesto", dueAt: DUE, ownerId: USER, companyId: "co-1", contactId: null, leadId: null, opportunityId: null };
const linkedEvent = { id: "evt-1", provider: "google", googleEventId: "g-1", googleUserId: USER };

beforeEach(() => {
  vi.clearAllMocks();
  taskFindFirst.mockResolvedValue(task);
  eventFindFirst.mockResolvedValue(null);
  createEvent.mockResolvedValue({ id: "evt-1", provider: "google", googleEventId: "g-1" });
  updateEvent.mockResolvedValue({ id: "evt-1", provider: "google", googleEventId: "g-1" });
  deleteEvent.mockResolvedValue(true);
});

describe("agregar tarea a Google Calendar", () => {
  it("crea UN evento en el calendario del usuario con los datos de la tarea y guarda el vínculo (taskId)", async () => {
    const result = await addTaskToGoogleCalendar(BIZ, USER, "task-1");

    expect(result.created).toBe(true);
    const [businessId, data, userId, options] = createEvent.mock.calls[0];
    expect(businessId).toBe(BIZ);
    expect(userId).toBe(USER);
    expect(options).toEqual({ taskId: "task-1" });
    expect(data).toMatchObject({
      title: "Contactar a Martín",
      description: "Llamar por el presupuesto",
      startsAt: "2026-09-24T17:00:00.000Z",
      endsAt: "2026-09-24T17:30:00.000Z",
      syncToGoogle: true,
      companyId: "co-1",
    });
  });

  it("la tarea se busca SIEMPRE dentro del negocio del usuario: una tarea de otro negocio no existe", async () => {
    taskFindFirst.mockResolvedValue(null);
    await expect(addTaskToGoogleCalendar("otro-negocio", USER, "task-1")).rejects.toThrow("task_not_found");
    expect(taskFindFirst).toHaveBeenCalledWith({ where: { id: "task-1", businessId: "otro-negocio" } });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("una tarea sin fecha de vencimiento no se puede agregar", async () => {
    taskFindFirst.mockResolvedValue({ ...task, dueAt: null });
    await expect(addTaskToGoogleCalendar(BIZ, USER, "task-1")).rejects.toThrow("task_without_due_date");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("no duplica: si ya está vinculada actualiza el evento existente en vez de crear otro", async () => {
    eventFindFirst.mockResolvedValue(linkedEvent);
    const result = await addTaskToGoogleCalendar(BIZ, USER, "task-1");

    expect(result.created).toBe(false);
    expect(createEvent).not.toHaveBeenCalled();
    expect(updateEvent).toHaveBeenCalledWith(BIZ, "evt-1", expect.objectContaining({ title: "Contactar a Martín" }), USER);
  });

  it("el vínculo se busca por el propio usuario (no usa el evento/conexión de otro)", async () => {
    await addTaskToGoogleCalendar(BIZ, USER, "task-1");
    expect(eventFindFirst).toHaveBeenCalledWith({ where: { businessId: BIZ, taskId: "task-1", provider: "google", googleUserId: USER } });
  });

  it("si el evento vinculado fue borrado directamente en Google, se descarta y se crea uno nuevo", async () => {
    eventFindFirst.mockResolvedValue(linkedEvent);
    updateEvent.mockResolvedValue({ id: "evt-1", provider: "internal", googleEventId: null }); // desvinculado
    const result = await addTaskToGoogleCalendar(BIZ, USER, "task-1");

    expect(deleteEvent).toHaveBeenCalledWith(BIZ, "evt-1", USER);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(true);
  });

  it("propaga los errores de Google (sin conexión) sin crear nada", async () => {
    createEvent.mockRejectedValue(new Error("google_not_connected"));
    await expect(addTaskToGoogleCalendar(BIZ, USER, "task-1")).rejects.toThrow("google_not_connected");
  });
});

describe("editar / quitar", () => {
  it("editar la tarea y volver a 'Actualizar evento' actualiza el evento de Google (no crea otro)", async () => {
    eventFindFirst.mockResolvedValue(linkedEvent);
    taskFindFirst.mockResolvedValue({ ...task, title: "Contactar a Martín (urgente)", dueAt: new Date("2026-09-24T19:00:00.000Z") });
    await addTaskToGoogleCalendar(BIZ, USER, "task-1");
    expect(updateEvent.mock.calls[0][2]).toMatchObject({ title: "Contactar a Martín (urgente)", startsAt: "2026-09-24T19:00:00.000Z" });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("quitar elimina el evento vinculado del propio usuario", async () => {
    eventFindFirst.mockResolvedValue(linkedEvent);
    expect(await removeTaskFromGoogleCalendar(BIZ, USER, "task-1")).toBe(true);
    expect(deleteEvent).toHaveBeenCalledWith(BIZ, "evt-1", USER);
  });

  it("quitar sin vínculo no hace nada", async () => {
    expect(await removeTaskFromGoogleCalendar(BIZ, USER, "task-1")).toBe(false);
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("quitar una tarea de otro negocio falla", async () => {
    taskFindFirst.mockResolvedValue(null);
    await expect(removeTaskFromGoogleCalendar("otro", USER, "task-1")).rejects.toThrow("task_not_found");
  });

  it("consulta si la tarea está vinculada (reconocer el evento)", async () => {
    expect(await getTaskGoogleLink(BIZ, USER, "task-1")).toEqual({ linked: false, eventId: null });
    eventFindFirst.mockResolvedValue(linkedEvent);
    expect(await getTaskGoogleLink(BIZ, USER, "task-1")).toEqual({ linked: true, eventId: "evt-1" });
  });
});
