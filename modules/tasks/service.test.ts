import { describe, expect, it, vi, beforeEach } from "vitest";

const taskCreate = vi.fn();
const taskFindMany = vi.fn();
const taskFindFirst = vi.fn();
const taskUpdate = vi.fn();
const taskDeleteMany = vi.fn();
const companyFindFirst = vi.fn();
const contactFindFirst = vi.fn();
const leadFindFirst = vi.fn();
const opportunityFindFirst = vi.fn();
const membershipFindFirst = vi.fn();
const activityCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      create: (...args: unknown[]) => taskCreate(...args),
      findMany: (...args: unknown[]) => taskFindMany(...args),
      findFirst: (...args: unknown[]) => taskFindFirst(...args),
      update: (...args: unknown[]) => taskUpdate(...args),
      deleteMany: (...args: unknown[]) => taskDeleteMany(...args),
    },
    company: { findFirst: (...args: unknown[]) => companyFindFirst(...args) },
    contact: { findFirst: (...args: unknown[]) => contactFindFirst(...args) },
    lead: { findFirst: (...args: unknown[]) => leadFindFirst(...args) },
    opportunity: { findFirst: (...args: unknown[]) => opportunityFindFirst(...args) },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
    activity: { create: (...args: unknown[]) => activityCreate(...args) },
  },
}));

const { createTask, listTasks, updateTask, completeTask, reopenTask, addTaskComment } = await import("./service");

beforeEach(() => {
  taskCreate.mockReset();
  taskFindMany.mockReset();
  taskFindFirst.mockReset();
  taskUpdate.mockReset();
  taskDeleteMany.mockReset();
  companyFindFirst.mockReset();
  contactFindFirst.mockReset();
  leadFindFirst.mockReset();
  opportunityFindFirst.mockReset();
  membershipFindFirst.mockReset();
  activityCreate.mockReset();
  activityCreate.mockResolvedValue({ id: "activity_1" });
});

describe("createTask", () => {
  it("crea la tarea con description", async () => {
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Llamar al cliente", description: "Confirmar pedido #123" }, "user_1");
    expect(taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: "biz_1", title: "Llamar al cliente", description: "Confirmar pedido #123", createdById: "user_1" }),
      })
    );
  });

  it("crea la tarea con priority explícita (o 'medium' por default)", async () => {
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Urgente", priority: "urgent" }, "user_1");
    expect(taskCreate.mock.calls[0][0].data.priority).toBe("urgent");

    taskCreate.mockResolvedValue({ id: "task_2" });
    await createTask("biz_1", { title: "Sin prioridad" }, "user_1");
    expect(taskCreate.mock.calls[1][0].data.priority).toBe("medium");
  });

  it("convierte dueAt/startDate (string) a Date", async () => {
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", dueAt: "2026-12-31", startDate: "2026-12-01" }, "user_1");
    const call = taskCreate.mock.calls[0][0];
    expect(call.data.dueAt).toBeInstanceOf(Date);
    expect(call.data.startDate).toBeInstanceOf(Date);
  });

  it("asigna la tarea a un usuario del MISMO Business y registra Activity 'assigned'", async () => {
    membershipFindFirst.mockResolvedValue({ id: "membership_1" });
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", ownerId: "user_2" }, "user_1");
    expect(membershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: "biz_1", userId: "user_2" } })
    );
    expect(taskCreate.mock.calls[0][0].data.ownerId).toBe("user_2");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "assigned", relatedId: "task_1" }) })
    );
  });

  it("bloquea la asignación a un usuario de OTRO Business (Membership no existe en este Business)", async () => {
    membershipFindFirst.mockResolvedValue(null);
    await expect(createTask("biz_1", { title: "Tarea", ownerId: "user_de_otro_negocio" }, "user_1")).rejects.toThrow(
      "user_not_in_business"
    );
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("asocia la tarea a una Company del mismo Business", async () => {
    companyFindFirst.mockResolvedValue({ id: "company_1" });
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", companyId: "company_1" }, "user_1");
    expect(companyFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "company_1", businessId: "biz_1" } }));
    expect(taskCreate.mock.calls[0][0].data.companyId).toBe("company_1");
  });

  it("rechaza asociar una Company de otro Business", async () => {
    companyFindFirst.mockResolvedValue(null);
    await expect(createTask("biz_1", { title: "Tarea", companyId: "company_de_otro_biz" }, "user_1")).rejects.toThrow(
      "company_not_found"
    );
  });

  it("asocia la tarea a un Contact del mismo Business", async () => {
    contactFindFirst.mockResolvedValue({ id: "contact_1" });
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", contactId: "contact_1" }, "user_1");
    expect(contactFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "contact_1", businessId: "biz_1" } }));
    expect(taskCreate.mock.calls[0][0].data.contactId).toBe("contact_1");
  });

  it("asocia la tarea a un Lead del mismo Business", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1" });
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", leadId: "lead_1" }, "user_1");
    expect(leadFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead_1", businessId: "biz_1" } }));
    expect(taskCreate.mock.calls[0][0].data.leadId).toBe("lead_1");
  });

  it("asocia la tarea a una Opportunity del mismo Business", async () => {
    opportunityFindFirst.mockResolvedValue({ id: "opp_1" });
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", opportunityId: "opp_1" }, "user_1");
    expect(opportunityFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "opp_1", businessId: "biz_1" } }));
    expect(taskCreate.mock.calls[0][0].data.opportunityId).toBe("opp_1");
  });
});

describe("updateTask", () => {
  it("cambia el status y registra Activity 'status_change'", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1", businessId: "biz_1", status: "todo", priority: "medium", ownerId: null, dueAt: null });
    taskUpdate.mockResolvedValue({ id: "task_1", status: "in_progress" });
    const updated = await updateTask("biz_1", "task_1", { status: "in_progress" }, "user_1");
    expect(updated).toEqual({ id: "task_1", status: "in_progress" });
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "status_change", body: "todo → in_progress" }) })
    );
  });

  it("cambia el assignee y registra Activity 'assigned'", async () => {
    membershipFindFirst.mockResolvedValue({ id: "membership_1" });
    taskFindFirst.mockResolvedValue({ id: "task_1", businessId: "biz_1", status: "todo", priority: "medium", ownerId: "user_2", dueAt: null });
    taskUpdate.mockResolvedValue({ id: "task_1", ownerId: "user_3" });
    await updateTask("biz_1", "task_1", { ownerId: "user_3" }, "user_1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "assigned" }) })
    );
  });

  it("no permite reasignar a un usuario de otro Business", async () => {
    membershipFindFirst.mockResolvedValue(null);
    await expect(updateTask("biz_1", "task_1", { ownerId: "user_de_otro_biz" }, "user_1")).rejects.toThrow("user_not_in_business");
    expect(taskUpdate).not.toHaveBeenCalled();
  });
});

describe("completar / reabrir", () => {
  it("completeTask setea status 'completed' y completedAt, scopeado por businessId", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1", businessId: "biz_1", status: "todo", priority: "medium", ownerId: null, dueAt: null });
    taskUpdate.mockResolvedValue({ id: "task_1", status: "completed" });
    const updated = await completeTask("biz_1", "task_1", "user_1");
    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task_1" }, data: expect.objectContaining({ status: "completed", completedAt: expect.any(Date) }) })
    );
    expect(updated).toEqual({ id: "task_1", status: "completed" });
  });

  it("reopenTask vuelve a 'todo' y limpia completedAt", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1", businessId: "biz_1", status: "completed", priority: "medium", ownerId: null, dueAt: null, completedAt: new Date() });
    taskUpdate.mockResolvedValue({ id: "task_1", status: "todo" });
    const updated = await reopenTask("biz_1", "task_1", "user_1");
    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task_1" }, data: expect.objectContaining({ status: "todo", completedAt: null }) })
    );
    expect(updated).toEqual({ id: "task_1", status: "todo" });
  });

  it("completeTask sobre una tarea de OTRO negocio no encuentra nada (findFirst scopeado)", async () => {
    taskFindFirst.mockResolvedValue(null);
    const updated = await completeTask("biz_A", "task_de_biz_B", "user_1");
    expect(taskFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task_de_biz_B", businessId: "biz_A" } }));
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(updated).toBeNull();
  });
});

describe("comentarios", () => {
  it("addTaskComment crea una Activity tipo 'comment' asociada a la tarea", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1" });
    activityCreate.mockResolvedValue({ id: "activity_comment_1", type: "comment", body: "Hola" });
    const comment = await addTaskComment("biz_1", "task_1", "Hola", "user_1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ relatedType: "task", relatedId: "task_1", type: "comment", body: "Hola", ownerId: "user_1" }) })
    );
    expect(comment).toEqual({ id: "activity_comment_1", type: "comment", body: "Hola" });
  });

  it("addTaskComment sobre una tarea de otro Business no escribe nada", async () => {
    taskFindFirst.mockResolvedValue(null);
    const comment = await addTaskComment("biz_A", "task_de_biz_B", "Hola", "user_1");
    expect(activityCreate).not.toHaveBeenCalled();
    expect(comment).toBeNull();
  });
});

describe("aislamiento multi-tenant", () => {
  it("listTasks siempre filtra por businessId", async () => {
    taskFindMany.mockResolvedValue([]);
    await listTasks("biz_A");
    expect(taskFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "biz_A" }) }));
  });

  it("updateTask sobre una tarea de OTRO negocio no actualiza nada", async () => {
    taskFindFirst.mockResolvedValue(null);
    const updated = await updateTask("biz_A", "task_de_biz_B", { title: "Hackeada" }, "user_1");
    expect(taskFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task_de_biz_B", businessId: "biz_A" } }));
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(updated).toBeNull();
  });
});
