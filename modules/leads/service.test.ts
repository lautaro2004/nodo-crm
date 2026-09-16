import { describe, expect, it, vi, beforeEach } from "vitest";

const leadCreate = vi.fn();
const leadFindFirst = vi.fn();
const leadUpdate = vi.fn();
const leadDeleteMany = vi.fn();
const companyFindFirst = vi.fn();
const activityCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      create: (...args: unknown[]) => leadCreate(...args),
      findFirst: (...args: unknown[]) => leadFindFirst(...args),
      update: (...args: unknown[]) => leadUpdate(...args),
      deleteMany: (...args: unknown[]) => leadDeleteMany(...args),
    },
    company: { findFirst: (...args: unknown[]) => companyFindFirst(...args) },
  },
}));

vi.mock("@/modules/activities/service", () => ({
  createActivity: (...args: unknown[]) => activityCreate(...args),
}));

const { createLead, updateLead, deleteLead } = await import("./service");

beforeEach(() => {
  leadCreate.mockReset();
  leadFindFirst.mockReset();
  leadUpdate.mockReset();
  leadDeleteMany.mockReset();
  companyFindFirst.mockReset();
  activityCreate.mockReset();
});

describe("createLead", () => {
  it("crea el lead con status 'new' por default y registra una Activity", async () => {
    leadCreate.mockResolvedValue({ id: "lead_1" });
    await createLead("biz_1", { name: "Prospecto" });
    expect(leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ businessId: "biz_1", status: "new" }) }));
    expect(activityCreate).toHaveBeenCalledWith("biz_1", expect.objectContaining({ relatedType: "lead", relatedId: "lead_1" }));
  });
});

describe("cambio de estado", () => {
  it("actualizar el status distinto del actual registra una Activity de tipo status_change", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "new" });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "qualified" });

    await updateLead("biz_1", "lead_1", { status: "qualified" });

    expect(activityCreate).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ relatedType: "lead", type: "status_change", body: "new → qualified" })
    );
  });

  it("si el status enviado es igual al actual, NO registra una Activity nueva", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead_1", status: "new" });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "new" });

    await updateLead("biz_1", "lead_1", { status: "new" });

    expect(activityCreate).not.toHaveBeenCalled();
  });
});

describe("aislamiento multi-tenant", () => {
  it("updateLead sobre un lead de OTRO negocio devuelve null (findFirst scopeado no lo encuentra)", async () => {
    leadFindFirst.mockResolvedValue(null);
    const result = await updateLead("biz_A", "lead_de_biz_B", { status: "qualified" });
    expect(leadFindFirst).toHaveBeenCalledWith({ where: { id: "lead_de_biz_B", businessId: "biz_A" } });
    expect(result).toBeNull();
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("deleteLead usa deleteMany con businessId en el where", async () => {
    leadDeleteMany.mockResolvedValue({ count: 0 });
    const ok = await deleteLead("biz_A", "lead_de_biz_B");
    expect(leadDeleteMany).toHaveBeenCalledWith({ where: { id: "lead_de_biz_B", businessId: "biz_A" } });
    expect(ok).toBe(false);
  });
});
