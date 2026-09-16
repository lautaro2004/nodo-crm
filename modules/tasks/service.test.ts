import { describe, expect, it, vi, beforeEach } from "vitest";

const taskCreate = vi.fn();
const taskFindMany = vi.fn();
const taskUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      create: (...args: unknown[]) => taskCreate(...args),
      findMany: (...args: unknown[]) => taskFindMany(...args),
      updateMany: (...args: unknown[]) => taskUpdateMany(...args),
    },
  },
}));

const { createTask, listTasks, completeTask, reopenTask } = await import("./service");

beforeEach(() => {
  taskCreate.mockReset();
  taskFindMany.mockReset();
  taskUpdateMany.mockReset();
});

describe("createTask", () => {
  it("crea la tarea con status 'pending' implícito (default del schema) y businessId", async () => {
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Llamar al cliente" });
    expect(taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: "biz_1", title: "Llamar al cliente" }) })
    );
  });

  it("convierte dueAt (string) a Date", async () => {
    taskCreate.mockResolvedValue({ id: "task_1" });
    await createTask("biz_1", { title: "Tarea", dueAt: "2026-12-31" });
    const call = taskCreate.mock.calls[0][0];
    expect(call.data.dueAt).toBeInstanceOf(Date);
  });
});

describe("completar / reabrir", () => {
  it("completeTask setea status: done, scopeado por businessId", async () => {
    taskUpdateMany.mockResolvedValue({ count: 1 });
    const ok = await completeTask("biz_1", "task_1");
    expect(taskUpdateMany).toHaveBeenCalledWith({ where: { id: "task_1", businessId: "biz_1" }, data: { status: "done" } });
    expect(ok).toBe(true);
  });

  it("reopenTask setea status: pending, scopeado por businessId", async () => {
    taskUpdateMany.mockResolvedValue({ count: 1 });
    const ok = await reopenTask("biz_1", "task_1");
    expect(taskUpdateMany).toHaveBeenCalledWith({ where: { id: "task_1", businessId: "biz_1" }, data: { status: "pending" } });
    expect(ok).toBe(true);
  });
});

describe("aislamiento multi-tenant", () => {
  it("listTasks siempre filtra por businessId", async () => {
    taskFindMany.mockResolvedValue([]);
    await listTasks("biz_A");
    expect(taskFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz_A" } }));
  });

  it("completeTask sobre una tarea de OTRO negocio no completa nada (count: 0)", async () => {
    taskUpdateMany.mockResolvedValue({ count: 0 });
    const ok = await completeTask("biz_A", "task_de_biz_B");
    expect(taskUpdateMany).toHaveBeenCalledWith({ where: { id: "task_de_biz_B", businessId: "biz_A" }, data: { status: "done" } });
    expect(ok).toBe(false);
  });
});
