import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const ruleFindMany = vi.fn();
const ruleUpdate = vi.fn();
const runCreate = vi.fn();
const runUpdate = vi.fn();
const leadFindFirst = vi.fn();
const leadFindMany = vi.fn();
const leadUpdateMany = vi.fn();
const taskCreate = vi.fn();
const activityCreate = vi.fn();
const notify = vi.fn();
const members = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    automationRule: { findMany: (...a: unknown[]) => ruleFindMany(...a), update: (...a: unknown[]) => ruleUpdate(...a) },
    automationRun: { create: (...a: unknown[]) => runCreate(...a), update: (...a: unknown[]) => runUpdate(...a) },
    lead: { findFirst: (...a: unknown[]) => leadFindFirst(...a), findMany: (...a: unknown[]) => leadFindMany(...a), updateMany: (...a: unknown[]) => leadUpdateMany(...a) },
    task: { create: (...a: unknown[]) => taskCreate(...a) },
  },
}));
vi.mock("@/modules/activities/service", () => ({ createActivity: (...a: unknown[]) => activityCreate(...a) }));
vi.mock("@/modules/notifications/service", () => ({ createNotification: (...a: unknown[]) => notify(...a) }));
vi.mock("@/modules/business/members", () => ({ listWorkspaceMembers: (...a: unknown[]) => members(...a) }));
vi.mock("@/modules/status-definitions/service", () => ({ getClosedLeadStatusKeys: async () => ["converted", "disqualified"] }));

const { runLeadCreatedAutomations, runLeadStatusAutomations, processUnattendedLeads } = await import("./engine");

const ANA = { userId: "u_ana", name: "Ana", email: "ana@x.com", role: "owner" };
const BETO = { userId: "u_beto", name: "Beto", email: "beto@x.com", role: "member" };

beforeEach(() => {
  [ruleFindMany, ruleUpdate, runCreate, runUpdate, leadFindFirst, leadFindMany, leadUpdateMany, taskCreate, activityCreate, notify, members].forEach((f) => f.mockReset());
  runCreate.mockResolvedValue({ id: "run_1" });
  members.mockResolvedValue([ANA, BETO]);
});

const assignRule = (config: object) => ({ id: "r1", businessId: "biz", name: "Reparto", type: "assign_lead", config, createdAt: new Date() });

describe("asignación automática", () => {
  it("rota entre responsables con el cursor atómico y solo si el lead sigue sin responsable", async () => {
    ruleFindMany.mockResolvedValue([assignRule({ mode: "round_robin", userIds: ["u_ana", "u_beto"], sources: [] })]);
    leadFindFirst.mockResolvedValue({ id: "l1", name: "Lead", ownerId: null, source: "manual" });
    ruleUpdate.mockResolvedValue({ cursor: 2 });
    leadUpdateMany.mockResolvedValue({ count: 1 });

    await runLeadCreatedAutomations("biz", "l1");

    expect(ruleUpdate).toHaveBeenCalledWith({ where: { id: "r1" }, data: { cursor: { increment: 1 } }, select: { cursor: true } });
    expect(leadUpdateMany).toHaveBeenCalledWith({ where: { id: "l1", businessId: "biz", ownerId: null }, data: { ownerId: "u_beto" } });
    expect(notify).toHaveBeenCalledWith("biz", "u_beto", expect.objectContaining({ type: "lead_assigned" }));
    expect(runUpdate).toHaveBeenCalledWith({ where: { id: "run_1" }, data: { status: "success", message: "Asignado a Beto." } });
  });

  it("no ejecuta dos veces el mismo evento (dedupe por índice único)", async () => {
    ruleFindMany.mockResolvedValue([assignRule({ mode: "fixed", userIds: ["u_ana"], sources: [] })]);
    leadFindFirst.mockResolvedValue({ id: "l1", name: "Lead", ownerId: null, source: "manual" });
    runCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));

    await runLeadCreatedAutomations("biz", "l1");

    expect(leadUpdateMany).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignora usuarios que ya no son miembros y registra 'skipped'", async () => {
    ruleFindMany.mockResolvedValue([assignRule({ mode: "fixed", userIds: ["u_ex"], sources: [] })]);
    leadFindFirst.mockResolvedValue({ id: "l1", name: "Lead", ownerId: null, source: "manual" });
    await runLeadCreatedAutomations("biz", "l1");
    expect(leadUpdateMany).not.toHaveBeenCalled();
    expect(runUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }));
  });

  it("respeta el filtro de origen y no toca leads que ya tienen responsable", async () => {
    ruleFindMany.mockResolvedValue([assignRule({ mode: "fixed", userIds: ["u_ana"], sources: ["nexo_inquiry"] })]);
    leadFindFirst.mockResolvedValue({ id: "l1", name: "Lead", ownerId: null, source: "manual" });
    await runLeadCreatedAutomations("biz", "l1");
    expect(runCreate).not.toHaveBeenCalled();

    leadFindFirst.mockResolvedValue({ id: "l2", name: "Lead", ownerId: "u_ana", source: "nexo_inquiry" });
    await runLeadCreatedAutomations("biz", "l2");
    expect(runCreate).not.toHaveBeenCalled();
  });

  it("un error del motor nunca rompe la creación del lead", async () => {
    ruleFindMany.mockRejectedValue(new Error("db caída"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runLeadCreatedAutomations("biz", "l1")).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("reglas por cambio de estado", () => {
  const statusRule = { id: "r2", businessId: "biz", name: "Calificado → tarea", type: "lead_status_change", createdAt: new Date(), config: { toStatus: "qualified", fromStatus: null, assignTo: null, onlyIfUnassigned: true, createTask: { title: "Enviar propuesta", dueInDays: 2 }, notifyOwner: true } };

  it("revalida que el lead siga en el estado antes de actuar", async () => {
    ruleFindMany.mockResolvedValue([statusRule]);
    leadFindFirst.mockResolvedValue({ id: "l1", name: "Lead", ownerId: "u_ana", status: "contacted" });
    await runLeadStatusAutomations("biz", { leadId: "l1", from: "new", to: "qualified", eventId: "a1" });
    expect(taskCreate).not.toHaveBeenCalled();
    expect(runUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }));
  });

  it("crea la tarea para el responsable y lo notifica", async () => {
    ruleFindMany.mockResolvedValue([statusRule]);
    leadFindFirst.mockResolvedValue({ id: "l1", name: "Lead", ownerId: "u_ana", status: "qualified" });
    taskCreate.mockResolvedValue({ id: "t1" });
    await runLeadStatusAutomations("biz", { leadId: "l1", from: "new", to: "qualified", eventId: "a1" });
    expect(runCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ dedupeKey: "lead:l1:status:a1" }) });
    expect(taskCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ title: "Enviar propuesta", leadId: "l1", ownerId: "u_ana", businessId: "biz" }) });
    expect(notify).toHaveBeenCalledWith("biz", "u_ana", expect.objectContaining({ type: "lead_status" }));
  });

  it("no aplica a otros estados", async () => {
    ruleFindMany.mockResolvedValue([statusRule]);
    await runLeadStatusAutomations("biz", { leadId: "l1", from: "new", to: "contacted", eventId: "a1" });
    expect(runCreate).not.toHaveBeenCalled();
  });
});

describe("leads sin atención", () => {
  const rule = { id: "r3", businessId: "biz", name: "24h", type: "lead_unattended", createdAt: new Date("2026-10-01"), config: { hours: 24 } };

  it("notifica al responsable una sola vez y nunca si ya hubo seguimiento", async () => {
    ruleFindMany.mockResolvedValue([rule]);
    leadFindMany.mockResolvedValue([{ id: "l1", name: "Lead 1", ownerId: "u_beto" }, { id: "l2", name: "Lead 2", ownerId: null }]);
    leadFindFirst
      .mockResolvedValueOnce({ lastFollowUpAt: null, status: "new", ownerId: "u_beto" })
      .mockResolvedValueOnce({ lastFollowUpAt: new Date(), status: "new", ownerId: null });

    const result = await processUnattendedLeads(new Date("2026-10-17T12:00:00Z"));

    const where = leadFindMany.mock.calls[0][0].where;
    expect(where.lastFollowUpAt).toBeNull();
    expect(where.status).toEqual({ notIn: ["converted", "disqualified"] });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("biz", "u_beto", expect.objectContaining({ type: "lead_unattended" }));
    expect(result).toMatchObject({ notified: 1, skipped: 1 });
  });

  it("sin responsable, avisa a dueños/administradores", async () => {
    ruleFindMany.mockResolvedValue([rule]);
    leadFindMany.mockResolvedValue([{ id: "l2", name: "Lead 2", ownerId: null }]);
    leadFindFirst.mockResolvedValue({ lastFollowUpAt: null, status: "new", ownerId: null });
    await processUnattendedLeads(new Date("2026-10-17T12:00:00Z"));
    expect(notify).toHaveBeenCalledWith("biz", "u_ana", expect.anything());
    expect(notify).not.toHaveBeenCalledWith("biz", "u_beto", expect.anything());
  });
});
