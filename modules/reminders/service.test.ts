import { describe, expect, it, vi, beforeEach } from "vitest";

const reminderCreate = vi.fn();
const reminderFindFirst = vi.fn();
const reminderFindMany = vi.fn();
const reminderUpdateMany = vi.fn();
const reminderUpdate = vi.fn();
const reminderDeleteMany = vi.fn();
const taskFindFirst = vi.fn();
const activityFindFirst = vi.fn();
const membershipFindFirst = vi.fn();
const notificationCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reminder: {
      create: (...a: unknown[]) => reminderCreate(...a),
      findFirst: (...a: unknown[]) => reminderFindFirst(...a),
      findMany: (...a: unknown[]) => reminderFindMany(...a),
      updateMany: (...a: unknown[]) => reminderUpdateMany(...a),
      update: (...a: unknown[]) => reminderUpdate(...a),
      deleteMany: (...a: unknown[]) => reminderDeleteMany(...a),
    },
    task: { findFirst: (...a: unknown[]) => taskFindFirst(...a) },
    activity: { findFirst: (...a: unknown[]) => activityFindFirst(...a) },
    membership: { findFirst: (...a: unknown[]) => membershipFindFirst(...a) },
    notification: { create: (...a: unknown[]) => notificationCreate(...a) },
  },
}));

const reminders = await import("./service");

const REMIND_AT = "2026-09-25T13:00:00.000Z";

beforeEach(() => {
  for (const m of [reminderCreate, reminderFindFirst, reminderFindMany, reminderUpdateMany, reminderUpdate, reminderDeleteMany, taskFindFirst, activityFindFirst, membershipFindFirst, notificationCreate])
    m.mockReset();
  membershipFindFirst.mockResolvedValue({ id: "m1" });
  reminderCreate.mockImplementation(async ({ data }) => ({ id: "r1", status: "pending", ...data }));
});

describe("createReminder", () => {
  it("1. crea un recordatorio de task válido, con businessId del servidor", async () => {
    taskFindFirst.mockResolvedValue({ id: "t1" });
    const r = await reminders.createReminder("biz-a", { userId: "u1", taskId: "t1", remindAt: REMIND_AT });
    expect(taskFindFirst.mock.calls[0][0].where).toEqual({ id: "t1", businessId: "biz-a" });
    expect(reminderCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", userId: "u1", taskId: "t1", activityId: null });
    expect(r.status).toBe("pending");
  });

  it("crea un recordatorio de activity válido", async () => {
    activityFindFirst.mockResolvedValue({ id: "a1" });
    await reminders.createReminder("biz-a", { userId: "u1", activityId: "a1", remindAt: REMIND_AT });
    expect(activityFindFirst.mock.calls[0][0].where).toEqual({ id: "a1", businessId: "biz-a" });
    expect(reminderCreate.mock.calls[0][0].data).toMatchObject({ activityId: "a1", taskId: null });
  });

  it("2. rechaza sin task ni activity, y rechaza con ambos a la vez", async () => {
    await expect(reminders.createReminder("biz-a", { userId: "u1", remindAt: REMIND_AT })).rejects.toThrow("target_required");
    await expect(reminders.createReminder("biz-a", { userId: "u1", taskId: "t1", activityId: "a1", remindAt: REMIND_AT })).rejects.toThrow("target_required");
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("2. rechaza una task inexistente o de otro Workspace", async () => {
    taskFindFirst.mockResolvedValue(null);
    await expect(reminders.createReminder("biz-b", { userId: "u2", taskId: "t-de-a", remindAt: REMIND_AT })).rejects.toThrow("task_not_found");
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("2. rechaza una activity inexistente o de otro Workspace", async () => {
    activityFindFirst.mockResolvedValue(null);
    await expect(reminders.createReminder("biz-b", { userId: "u2", activityId: "a-de-a", remindAt: REMIND_AT })).rejects.toThrow("activity_not_found");
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("3. no permite referencias cross-workspace: la task se busca SIEMPRE con el businessId del actor", async () => {
    taskFindFirst.mockResolvedValue(null);
    await reminders.createReminder("biz-b", { userId: "u2", taskId: "t1", remindAt: REMIND_AT }).catch(() => {});
    expect(taskFindFirst).toHaveBeenCalledWith({ where: { id: "t1", businessId: "biz-b" }, select: { id: true } });
  });

  it("8/9. valida que el destinatario pertenezca al Workspace (permisos + usuario correcto)", async () => {
    taskFindFirst.mockResolvedValue({ id: "t1" });
    membershipFindFirst.mockResolvedValue(null);
    await expect(reminders.createReminder("biz-a", { userId: "intruso", taskId: "t1", remindAt: REMIND_AT })).rejects.toThrow("user_not_in_business");
    expect(membershipFindFirst.mock.calls[0][0].where).toMatchObject({ businessId: "biz-a", userId: "intruso" });
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("rechaza una fecha inválida", async () => {
    taskFindFirst.mockResolvedValue({ id: "t1" });
    await expect(reminders.createReminder("biz-a", { userId: "u1", taskId: "t1", remindAt: "no-es-fecha" })).rejects.toThrow("invalid_date");
  });
});

describe("upsertTaskReminder (flujo del formulario de Task)", () => {
  it("crea uno nuevo si no había", async () => {
    taskFindFirst.mockResolvedValue({ id: "t1" });
    reminderFindFirst.mockResolvedValue(null);
    await reminders.upsertTaskReminder("biz-a", "t1", "u1", REMIND_AT);
    expect(reminderCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", taskId: "t1", userId: "u1" });
  });

  it("7. reprograma (no duplica) si ya existe uno pending para esa task", async () => {
    taskFindFirst.mockResolvedValue({ id: "t1" });
    reminderFindFirst.mockResolvedValue({ id: "existing", status: "pending" });
    reminderUpdate.mockResolvedValue({ id: "existing", status: "pending", remindAt: new Date(REMIND_AT) });
    const r = await reminders.upsertTaskReminder("biz-a", "t1", "u1", REMIND_AT);
    expect(reminderCreate).not.toHaveBeenCalled();
    expect(reminderUpdate).toHaveBeenCalledWith({ where: { id: "existing" }, data: { remindAt: new Date(REMIND_AT), userId: "u1" } });
    expect(r.id).toBe("existing");
  });

  it("task de otro Workspace -> task_not_found", async () => {
    taskFindFirst.mockResolvedValue(null);
    await expect(reminders.upsertTaskReminder("biz-b", "t-de-a", "u2", REMIND_AT)).rejects.toThrow("task_not_found");
  });
});

describe("updateReminder / cancelReminder / deleteReminder", () => {
  it("7. edita sólo si sigue pending y pertenece al Workspace", async () => {
    reminderUpdateMany.mockResolvedValue({ count: 0 });
    expect(await reminders.updateReminder("biz-b", "r1", REMIND_AT)).toBeNull();
    expect(reminderUpdateMany.mock.calls[0][0].where).toEqual({ id: "r1", businessId: "biz-b", status: "pending" });

    reminderUpdateMany.mockResolvedValue({ count: 1 });
    reminderFindFirst.mockResolvedValue({ id: "r1", status: "pending" });
    const r = await reminders.updateReminder("biz-a", "r1", REMIND_AT);
    expect(r?.id).toBe("r1");
  });

  it("6. cancela sólo si estaba pending (acotado por Workspace)", async () => {
    reminderUpdateMany.mockResolvedValue({ count: 0 });
    expect(await reminders.cancelReminder("biz-b", "r-de-a")).toBe(false);
    reminderUpdateMany.mockResolvedValue({ count: 1 });
    expect(await reminders.cancelReminder("biz-a", "r1")).toBe(true);
    expect(reminderUpdateMany).toHaveBeenLastCalledWith({ where: { id: "r1", businessId: "biz-a", status: "pending" }, data: { status: "cancelled" } });
  });

  it("elimina acotado por Workspace", async () => {
    reminderDeleteMany.mockResolvedValue({ count: 0 });
    expect(await reminders.deleteReminder("biz-b", "r-de-a")).toBe(false);
    reminderDeleteMany.mockResolvedValue({ count: 1 });
    expect(await reminders.deleteReminder("biz-a", "r1")).toBe(true);
  });
});

describe("processDueReminders", () => {
  const dueReminder = {
    id: "r1",
    businessId: "biz-a",
    userId: "u1",
    remindAt: new Date(REMIND_AT),
    task: { id: "t1", title: "Contactar a Martín", dueAt: new Date(REMIND_AT) },
    activity: null,
  };

  it("4. procesa un recordatorio vencido: pasa a sent y crea la notificación con lo mínimo pedido", async () => {
    reminderFindMany.mockResolvedValue([dueReminder]);
    reminderUpdateMany.mockResolvedValue({ count: 1 });
    const result = await reminders.processDueReminders(new Date("2026-09-25T13:05:00.000Z"));

    expect(reminderFindMany.mock.calls[0][0].where).toMatchObject({ status: "pending" });
    expect(reminderUpdateMany).toHaveBeenCalledWith({ where: { id: "r1", status: "pending" }, data: { status: "sent" } });
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({
      businessId: "biz-a",
      userId: "u1",
      type: "reminder",
      title: "Contactar a Martín",
      resourceHref: "/dashboard/tareas/t1",
    });
    // remindAt va en UTC (2026-09-25T13:00Z) y se muestra en hora de Argentina (UTC-3) = 10:00.
    expect(notificationCreate.mock.calls[0][0].data.body).toContain("10:00");
    expect(result).toEqual({ found: 1, sent: 1, skipped: 0 });
  });

  it("5. no procesa dos veces: la segunda pasada no encuentra nada pending (idempotencia por el WHERE status=pending del claim)", async () => {
    reminderFindMany.mockResolvedValueOnce([dueReminder]).mockResolvedValueOnce([]);
    reminderUpdateMany.mockResolvedValue({ count: 1 });

    const first = await reminders.processDueReminders(new Date("2026-09-25T13:05:00.000Z"));
    const second = await reminders.processDueReminders(new Date("2026-09-25T13:06:00.000Z"));

    expect(first.sent).toBe(1);
    expect(second).toEqual({ found: 0, sent: 0, skipped: 0 });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it("5. protección de concurrencia: si el claim atómico no logra reservarlo (ya lo tomó otra corrida), no crea notificación duplicada", async () => {
    reminderFindMany.mockResolvedValue([dueReminder]);
    reminderUpdateMany.mockResolvedValue({ count: 0 }); // otra corrida ya lo pasó a sent primero
    const result = await reminders.processDueReminders(new Date("2026-09-25T13:05:00.000Z"));
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ found: 1, sent: 0, skipped: 1 });
  });

  it("no toca recordatorios cancelados ni ya enviados (la query sólo trae status=pending)", async () => {
    reminderFindMany.mockResolvedValue([]);
    const result = await reminders.processDueReminders();
    expect(result).toEqual({ found: 0, sent: 0, skipped: 0 });
  });

  it("una activity relacionada resuelve el link a su propia entidad", async () => {
    reminderFindMany.mockResolvedValue([
      { ...dueReminder, id: "r2", task: null, activity: { id: "a1", relatedType: "opportunity", relatedId: "o1", type: "note", body: null } },
    ]);
    reminderUpdateMany.mockResolvedValue({ count: 1 });
    await reminders.processDueReminders(new Date("2026-09-25T13:05:00.000Z"));
    expect(notificationCreate.mock.calls[0][0].data.resourceHref).toBe("/dashboard/oportunidades/o1");
  });
});
