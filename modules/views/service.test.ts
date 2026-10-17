import { describe, expect, it, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
const update = vi.fn();
const deleteMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { savedView: { findFirst: (...a: unknown[]) => findFirst(...a), create: (...a: unknown[]) => create(...a), update: (...a: unknown[]) => update(...a), deleteMany: (...a: unknown[]) => deleteMany(...a) } },
}));

const { createView, updateView, deleteView } = await import("./service");
const OWNER = { userId: "u1", role: "owner" };
const MEMBER = { userId: "u2", role: "member" };

beforeEach(() => [findFirst, create, update, deleteMany].forEach((f) => f.mockReset()));

describe("vistas guardadas — permisos", () => {
  it("un miembro no puede crear vistas compartidas", async () => {
    await expect(createView("biz", MEMBER, { entityType: "lead", name: "X", params: "a=1", shared: true })).rejects.toThrow("forbidden");
  });

  it("normaliza los parámetros (sin 'view', orden estable)", async () => {
    await createView("biz", MEMBER, { entityType: "lead", name: " Mis nuevos ", params: "view=abc&status=new&cols=name,status" });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Mis nuevos", params: "cols=name%2Cstatus&status=new", shared: false, createdBy: "u2" }) });
  });

  it("nadie edita la vista personal de otro", async () => {
    findFirst.mockResolvedValue({ id: "v1", shared: false, createdBy: "u1" });
    await expect(updateView("biz", "v1", MEMBER, { name: "robada" })).rejects.toThrow("forbidden");
  });

  it("una vista compartida solo la borra un dueño/admin", async () => {
    findFirst.mockResolvedValue({ id: "v1", shared: true, createdBy: "u2" });
    await expect(deleteView("biz", "v1", MEMBER)).rejects.toThrow("forbidden");
    expect(await deleteView("biz", "v1", OWNER)).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "v1", businessId: "biz" } });
  });

  it("una vista de otro negocio no existe", async () => {
    findFirst.mockResolvedValue(null);
    expect(await updateView("biz", "v_ajena", OWNER, { name: "x" })).toBeNull();
  });
});
