import { describe, expect, it, vi, beforeEach } from "vitest";

const sdFindFirst = vi.fn();
const sdFindMany = vi.fn();
const sdDeleteMany = vi.fn();
const sdCreate = vi.fn();
const sdAggregate = vi.fn();
const leadCount = vi.fn();
const companyCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    statusDefinition: {
      findFirst: (...a: unknown[]) => sdFindFirst(...a),
      findMany: (...a: unknown[]) => sdFindMany(...a),
      deleteMany: (...a: unknown[]) => sdDeleteMany(...a),
      create: (...a: unknown[]) => sdCreate(...a),
      aggregate: (...a: unknown[]) => sdAggregate(...a),
    },
    lead: { count: (...a: unknown[]) => leadCount(...a) },
    company: { count: (...a: unknown[]) => companyCount(...a) },
  },
}));

const { deleteStatusDefinition, assertValidStatus, createStatusDefinition, listStatusOptions } = await import("./service");

beforeEach(() => {
  [sdFindFirst, sdFindMany, sdDeleteMany, sdCreate, sdAggregate, leadCount, companyCount].forEach((f) => f.mockReset());
});

describe("deleteStatusDefinition", () => {
  it("no borra un estado que usan leads (evita estados huérfanos)", async () => {
    sdFindFirst.mockResolvedValue({ id: "sd_1", entityType: "lead", key: "contacted" });
    leadCount.mockResolvedValue(3);
    await expect(deleteStatusDefinition("biz_1", "sd_1")).rejects.toThrow("status_in_use");
    expect(leadCount).toHaveBeenCalledWith({ where: { businessId: "biz_1", status: "contacted" } });
    expect(sdDeleteMany).not.toHaveBeenCalled();
  });

  it("borra si no está en uso, scopeado por businessId", async () => {
    sdFindFirst.mockResolvedValue({ id: "sd_1", entityType: "company", key: "vip" });
    companyCount.mockResolvedValue(0);
    sdDeleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteStatusDefinition("biz_1", "sd_1")).toBe(true);
    expect(sdDeleteMany).toHaveBeenCalledWith({ where: { id: "sd_1", businessId: "biz_1" } });
  });

  it("un id de otro negocio devuelve false", async () => {
    sdFindFirst.mockResolvedValue(null);
    expect(await deleteStatusDefinition("biz_1", "sd_ajeno")).toBe(false);
  });
});

describe("assertValidStatus", () => {
  it("acepta claves del sistema sin consultar", async () => {
    await assertValidStatus("biz_1", "company", "archived");
    expect(sdFindFirst).not.toHaveBeenCalled();
  });
  it("rechaza claves no configuradas", async () => {
    sdFindFirst.mockResolvedValue(null);
    await expect(assertValidStatus("biz_1", "lead", "xyz")).rejects.toThrow("invalid_status");
  });
});

describe("createStatusDefinition", () => {
  it("rechaza una clave duplicada en vez de explotar con un 500", async () => {
    sdFindFirst.mockResolvedValue({ id: "sd_1" });
    await expect(createStatusDefinition("biz_1", { entityType: "lead", key: "nuevo", label: "Nuevo" })).rejects.toThrow("status_key_taken");
  });
  it("lo agrega al final del orden y persiste el color", async () => {
    sdFindFirst.mockResolvedValue(null);
    sdAggregate.mockResolvedValue({ _max: { order: 4 } });
    await createStatusDefinition("biz_1", { entityType: "lead", key: "demo", label: "Demo", color: "teal" });
    expect(sdCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ order: 5, color: "teal" }) });
  });
});

describe("listStatusOptions", () => {
  it("completa 'new' y 'converted' para leads si faltan", async () => {
    sdFindMany.mockResolvedValue([{ key: "contacted", label: "Contactado", color: "blue" }]);
    const opts = await listStatusOptions("biz_1", "lead");
    expect(opts.map((o) => o.key)).toEqual(["new", "contacted", "converted"]);
  });
});
