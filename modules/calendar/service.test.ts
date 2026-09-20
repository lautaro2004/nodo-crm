import { describe, expect, it, vi, beforeEach } from "vitest";

const eventCreate = vi.fn();
const eventFindMany = vi.fn();
const eventFindFirst = vi.fn();
const eventUpdate = vi.fn();
const eventDeleteMany = vi.fn();
const taskFindMany = vi.fn();
const companyFindFirst = vi.fn();
const contactFindFirst = vi.fn();
const leadFindFirst = vi.fn();
const opportunityFindFirst = vi.fn();
const membershipFindFirst = vi.fn();
const activityCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendarEvent: {
      create: (...a: unknown[]) => eventCreate(...a),
      findMany: (...a: unknown[]) => eventFindMany(...a),
      findFirst: (...a: unknown[]) => eventFindFirst(...a),
      update: (...a: unknown[]) => eventUpdate(...a),
      deleteMany: (...a: unknown[]) => eventDeleteMany(...a),
    },
    task: { findMany: (...a: unknown[]) => taskFindMany(...a) },
    company: { findFirst: (...a: unknown[]) => companyFindFirst(...a) },
    contact: { findFirst: (...a: unknown[]) => contactFindFirst(...a) },
    lead: { findFirst: (...a: unknown[]) => leadFindFirst(...a) },
    opportunity: { findFirst: (...a: unknown[]) => opportunityFindFirst(...a) },
    membership: { findFirst: (...a: unknown[]) => membershipFindFirst(...a) },
    activity: { create: (...a: unknown[]) => activityCreate(...a) },
  },
}));

const { createEvent, updateEvent, deleteEvent, listEvents, listUpcomingEvents, findConflicts, getEvent, listTaskDueDates } =
  await import("./service");

const START = "2026-09-25T18:00:00.000Z";
const END = "2026-09-25T19:00:00.000Z";

function baseEvent(over: Record<string, unknown> = {}) {
  return {
    id: "ev1",
    businessId: "biz-a",
    title: "Reunión con Acme",
    type: "meeting",
    status: "scheduled",
    startsAt: new Date(START),
    endsAt: new Date(END),
    ownerId: null,
    companyId: null,
    contactId: null,
    leadId: null,
    opportunityId: null,
    ...over,
  };
}

beforeEach(() => {
  for (const m of [
    eventCreate, eventFindMany, eventFindFirst, eventUpdate, eventDeleteMany, taskFindMany,
    companyFindFirst, contactFindFirst, leadFindFirst, opportunityFindFirst, membershipFindFirst, activityCreate,
  ]) m.mockReset();
  eventCreate.mockImplementation(async ({ data }) => ({ id: "ev1", ...data }));
  eventUpdate.mockImplementation(async ({ data }) => ({ ...baseEvent(), ...data }));
  eventFindMany.mockResolvedValue([]);
  eventDeleteMany.mockResolvedValue({ count: 1 });
  activityCreate.mockResolvedValue({});
});

describe("createEvent", () => {
  it("crea el evento con businessId del servidor y valores por defecto", async () => {
    const ev = await createEvent("biz-a", { title: "Demo", startsAt: START, endsAt: END }, "u1");
    const data = eventCreate.mock.calls[0][0].data;
    expect(data.businessId).toBe("biz-a");
    expect(data.type).toBe("meeting");
    expect(data.createdById).toBe("u1");
    expect(ev.id).toBe("ev1");
  });

  it("rechaza hora final anterior o igual a la inicial", async () => {
    await expect(createEvent("biz-a", { title: "x", startsAt: END, endsAt: START }, "u1")).rejects.toThrow("invalid_time_range");
    await expect(createEvent("biz-a", { title: "x", startsAt: START, endsAt: START }, "u1")).rejects.toThrow("invalid_time_range");
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("rechaza fechas inválidas", async () => {
    await expect(createEvent("biz-a", { title: "x", startsAt: "nope", endsAt: END }, "u1")).rejects.toThrow("invalid_date");
  });

  it.each([
    ["companyId", companyFindFirst, "company"],
    ["contactId", contactFindFirst, "contact"],
    ["leadId", leadFindFirst, "lead"],
    ["opportunityId", opportunityFindFirst, "opportunity"],
  ] as const)("relaciona con %s y registra Activity en esa entidad", async (field, finder, relatedType) => {
    finder.mockResolvedValue({ id: "rel1" });
    await createEvent("biz-a", { title: "Demo", startsAt: START, endsAt: END, [field]: "rel1" }, "u1");
    expect(finder).toHaveBeenCalledWith({ where: { id: "rel1", businessId: "biz-a" }, select: { id: true } });
    expect(activityCreate).toHaveBeenCalledTimes(1);
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", relatedType, relatedId: "rel1", type: "event_scheduled", ownerId: "u1" });
  });

  it.each([
    ["companyId", companyFindFirst, "company_not_found"],
    ["contactId", contactFindFirst, "contact_not_found"],
    ["leadId", leadFindFirst, "lead_not_found"],
    ["opportunityId", opportunityFindFirst, "opportunity_not_found"],
  ] as const)("impide relación cross-tenant en %s", async (field, finder, code) => {
    finder.mockResolvedValue(null); // existe en otro Business => no aparece con businessId actual
    await expect(createEvent("biz-a", { title: "x", startsAt: START, endsAt: END, [field]: "de-otro-negocio" }, "u1")).rejects.toThrow(code);
    expect(eventCreate).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("impide asignar un responsable que no es miembro del Business", async () => {
    membershipFindFirst.mockResolvedValue(null);
    await expect(createEvent("biz-a", { title: "x", startsAt: START, endsAt: END, ownerId: "intruso" }, "u1")).rejects.toThrow("user_not_in_business");
    expect(membershipFindFirst.mock.calls[0][0].where).toMatchObject({ businessId: "biz-a", userId: "intruso" });
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("un evento con varias relaciones deja Activity en cada una", async () => {
    companyFindFirst.mockResolvedValue({ id: "c1" });
    opportunityFindFirst.mockResolvedValue({ id: "o1" });
    await createEvent("biz-a", { title: "x", startsAt: START, endsAt: END, companyId: "c1", opportunityId: "o1" }, "u1");
    expect(activityCreate.mock.calls.map((c) => c[0].data.relatedType)).toEqual(["company", "opportunity"]);
  });
});

describe("updateEvent", () => {
  it("devuelve null si el evento no es del Business (aislamiento)", async () => {
    eventFindFirst.mockResolvedValue(null);
    expect(await updateEvent("biz-b", "ev1", { title: "hack" }, "u2")).toBeNull();
    expect(eventFindFirst).toHaveBeenCalledWith({ where: { id: "ev1", businessId: "biz-b" } });
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it("edita el título sin generar historial", async () => {
    eventFindFirst.mockResolvedValue(baseEvent({ opportunityId: "o1" }));
    await updateEvent("biz-a", "ev1", { title: "Nuevo título" }, "u1");
    expect(eventUpdate.mock.calls[0][0].data.title).toBe("Nuevo título");
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("cambiar fecha/hora registra event_rescheduled", async () => {
    eventFindFirst.mockResolvedValue(baseEvent({ opportunityId: "o1" }));
    eventUpdate.mockImplementation(async ({ data }) => ({ ...baseEvent({ opportunityId: "o1" }), ...data }));
    await updateEvent("biz-a", "ev1", { startsAt: "2026-09-26T18:00:00.000Z", endsAt: "2026-09-26T19:00:00.000Z" }, "u1");
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ relatedType: "opportunity", relatedId: "o1", type: "event_rescheduled" });
  });

  it("valida el rango contra los valores existentes al cambiar sólo un extremo", async () => {
    eventFindFirst.mockResolvedValue(baseEvent());
    await expect(updateEvent("biz-a", "ev1", { endsAt: "2026-09-25T17:00:00.000Z" }, "u1")).rejects.toThrow("invalid_time_range");
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it("cambiar responsable valida membresía y registra event_reassigned", async () => {
    eventFindFirst.mockResolvedValue(baseEvent({ leadId: "l1", ownerId: "u1" }));
    eventUpdate.mockImplementation(async ({ data }) => ({ ...baseEvent({ leadId: "l1" }), ...data }));
    membershipFindFirst.mockResolvedValue({ id: "m" });
    await updateEvent("biz-a", "ev1", { ownerId: "u2" }, "u1");
    expect(membershipFindFirst.mock.calls[0][0].where).toMatchObject({ businessId: "biz-a", userId: "u2" });
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ relatedType: "lead", type: "event_reassigned" });
  });

  it("cancelar registra event_cancelled; completar registra event_completed", async () => {
    eventFindFirst.mockResolvedValue(baseEvent({ contactId: "c1" }));
    eventUpdate.mockImplementation(async ({ data }) => ({ ...baseEvent({ contactId: "c1" }), ...data }));
    await updateEvent("biz-a", "ev1", { status: "cancelled" }, "u1");
    expect(activityCreate.mock.calls[0][0].data.type).toBe("event_cancelled");
    activityCreate.mockClear();
    await updateEvent("biz-a", "ev1", { status: "completed" }, "u1");
    expect(activityCreate.mock.calls[0][0].data.type).toBe("event_completed");
  });

  it("no permite reasignar a una entidad de otro Business", async () => {
    eventFindFirst.mockResolvedValue(baseEvent());
    opportunityFindFirst.mockResolvedValue(null);
    await expect(updateEvent("biz-a", "ev1", { opportunityId: "ajena" }, "u1")).rejects.toThrow("opportunity_not_found");
    expect(eventUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteEvent", () => {
  it("elimina sólo dentro del Business y deja rastro en Activity", async () => {
    eventFindFirst.mockResolvedValue(baseEvent({ companyId: "c1" }));
    expect(await deleteEvent("biz-a", "ev1", "u1")).toBe(true);
    expect(eventDeleteMany).toHaveBeenCalledWith({ where: { id: "ev1", businessId: "biz-a" } });
    expect(activityCreate.mock.calls[0][0].data.type).toBe("event_cancelled");
  });

  it("devuelve false para un evento de otro Business", async () => {
    eventFindFirst.mockResolvedValue(null);
    expect(await deleteEvent("biz-b", "ev1", "u2")).toBe(false);
    expect(eventDeleteMany).not.toHaveBeenCalled();
  });
});

describe("listEvents / getEvent", () => {
  it("siempre filtra por businessId", async () => {
    await listEvents("biz-a");
    expect(eventFindMany.mock.calls[0][0].where.businessId).toBe("biz-a");
  });

  it("filtra por responsable, tipo y rango por solapamiento", async () => {
    const from = new Date(START);
    const to = new Date(END);
    await listEvents("biz-a", { from, to, ownerId: "u1", type: "call" });
    expect(eventFindMany.mock.calls[0][0].where).toMatchObject({
      businessId: "biz-a",
      ownerId: "u1",
      type: "call",
      endsAt: { gt: from },
      startsAt: { lt: to },
    });
  });

  it("filtra por entidad relacionada (próximas actividades)", async () => {
    await listUpcomingEvents("biz-a", { opportunityId: "o1" });
    expect(eventFindMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz-a", opportunityId: "o1", status: "scheduled" });
  });

  it("getEvent no devuelve eventos de otro Business", async () => {
    eventFindFirst.mockResolvedValue(null);
    expect(await getEvent("biz-b", "ev1")).toBeNull();
    expect(eventFindFirst.mock.calls[0][0].where).toEqual({ id: "ev1", businessId: "biz-b" });
  });
});

describe("findConflicts", () => {
  it("detecta solapamiento del mismo responsable, excluyendo el evento editado", async () => {
    eventFindMany.mockResolvedValue([{ id: "ev2", title: "Otra" }]);
    const res = await findConflicts("biz-a", { ownerId: "u1", startsAt: START, endsAt: END, excludeId: "ev1" });
    expect(res).toHaveLength(1);
    expect(eventFindMany.mock.calls[0][0].where).toMatchObject({
      businessId: "biz-a",
      ownerId: "u1",
      status: "scheduled",
      id: { not: "ev1" },
    });
  });

  it("sin responsable no hay conflicto ni query", async () => {
    expect(await findConflicts("biz-a", { ownerId: null, startsAt: START, endsAt: END })).toEqual([]);
    expect(eventFindMany).not.toHaveBeenCalled();
  });
});

describe("listTaskDueDates", () => {
  it("sólo tareas abiertas del Business en el rango", async () => {
    taskFindMany.mockResolvedValue([]);
    await listTaskDueDates("biz-a", new Date(START), new Date(END), "u1");
    expect(taskFindMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz-a", ownerId: "u1", status: { in: ["todo", "in_progress"] } });
  });
});
