import { beforeEach, describe, expect, it, vi } from "vitest";

const oppFindFirst = vi.fn();
const oppUpdate = vi.fn();
const itemFindMany = vi.fn();
const itemCreate = vi.fn();
const recordFindFirst = vi.fn();
const valueFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: { findFirst: (...a: unknown[]) => oppFindFirst(...a), update: (...a: unknown[]) => oppUpdate(...a) },
    opportunityItem: { findMany: (...a: unknown[]) => itemFindMany(...a), create: (...a: unknown[]) => itemCreate(...a) },
    customRecord: { findFirst: (...a: unknown[]) => recordFindFirst(...a) },
    customFieldValue: { findUnique: (...a: unknown[]) => valueFindUnique(...a) },
  },
}));

const { addItem, applyItemsTotal, itemsTotal } = await import("./service");

beforeEach(() => {
  for (const f of [oppFindFirst, oppUpdate, itemFindMany, itemCreate, recordFindFirst, valueFindUnique]) f.mockReset();
});

describe("productos en oportunidades", () => {
  it("al agregar copia nombre y precio actual (snapshot) sin tocar el valor de la oportunidad", async () => {
    oppFindFirst.mockResolvedValue({ id: "o1", status: "open" });
    recordFindFirst.mockResolvedValue({ id: "r1", title: "Taladro", module: { priceFieldId: "def_precio" } });
    valueFindUnique.mockResolvedValue({ value: "1500.5" });
    itemCreate.mockResolvedValue({ id: "i1" });
    await addItem("biz", "o1", { recordId: "r1" });
    expect(itemCreate).toHaveBeenCalledWith({
      data: { businessId: "biz", opportunityId: "o1", recordId: "r1", nameSnapshot: "Taladro", unitPrice: 1500.5, quantity: 1 },
    });
    expect(oppUpdate).not.toHaveBeenCalled();
  });

  it("valida negocio de la oportunidad y del producto", async () => {
    oppFindFirst.mockResolvedValue(null);
    await expect(addItem("biz", "o_ajena", { recordId: "r1" })).rejects.toThrow("opportunity_not_found");
    oppFindFirst.mockResolvedValue({ id: "o1", status: "open" });
    recordFindFirst.mockResolvedValue(null);
    await expect(addItem("biz", "o1", { recordId: "r_ajeno" })).rejects.toThrow("record_not_found");
    expect(recordFindFirst.mock.calls[0][0].where).toMatchObject({ id: "r_ajeno", businessId: "biz" });
  });

  it("oportunidades cerradas no se modifican ni se recalculan", async () => {
    oppFindFirst.mockResolvedValue({ id: "o1", status: "won" });
    await expect(addItem("biz", "o1", { recordId: "r1" })).rejects.toThrow("opportunity_closed");
    await expect(applyItemsTotal("biz", "o1")).rejects.toThrow("opportunity_closed");
    expect(oppUpdate).not.toHaveBeenCalled();
  });

  it("'Usar total de productos' aplica la suma con los precios aplicados", async () => {
    oppFindFirst.mockResolvedValue({ id: "o1", status: "open" });
    itemFindMany.mockResolvedValue([
      { unitPrice: 1500.5, quantity: 1 },
      { unitPrice: 2000, quantity: 2 },
    ]);
    expect(await applyItemsTotal("biz", "o1")).toBe(5500.5);
    expect(oppUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { amount: 5500.5 } });
    expect(itemsTotal([{ unitPrice: 0.1, quantity: 3 }])).toBe(0.3);
  });
});
