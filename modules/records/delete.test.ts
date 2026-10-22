import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteLead = vi.fn();
const deleteRecord = vi.fn();
vi.mock("@/modules/leads/service", () => ({ deleteLead: (...a: unknown[]) => deleteLead(...a) }));
vi.mock("@/modules/contacts/service", () => ({ deleteContact: vi.fn() }));
vi.mock("@/modules/companies/service", () => ({ deleteCompany: vi.fn() }));
vi.mock("@/modules/opportunities/service", () => ({ deleteOpportunity: vi.fn() }));
vi.mock("@/modules/custom-modules/records", () => ({ deleteRecord: (...a: unknown[]) => deleteRecord(...a) }));

const counts = {
  company: vi.fn(),
  contact: vi.fn(),
  lead: vi.fn(),
  opportunity: vi.fn(),
  task: vi.fn(),
  opportunityItem: vi.fn(),
  customRecord: vi.fn(),
  activity: vi.fn(),
  recordLink: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({
  prisma: Object.fromEntries(Object.entries(counts).map(([k, fn]) => [k, { count: (...a: unknown[]) => fn(...a) }])),
}));

const { deleteRecords, getDeletionImpact, isDeletableEntity } = await import("./delete");

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(counts).forEach((fn) => fn.mockResolvedValue(0));
});

describe("deleteRecords", () => {
  it("borra con la misma función que el DELETE individual, siempre con el businessId", async () => {
    deleteLead.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("db"));
    const r = await deleteRecords("biz_A", "lead", ["l1", "l2", "l3", "l1"]);
    expect(deleteLead.mock.calls).toEqual([
      ["biz_A", "l1"],
      ["biz_A", "l2"],
      ["biz_A", "l3"],
    ]);
    expect(r).toEqual({ deleted: ["l1"], notFound: ["l2"], failed: ["l3"] });
  });

  it("módulos personalizados: el moduleId sale del entityType", async () => {
    deleteRecord.mockResolvedValue(true);
    await deleteRecords("biz_A", "cm:mod_1", ["r1"]);
    expect(deleteRecord).toHaveBeenCalledWith("biz_A", "mod_1", "r1");
  });

  it("solo acepta tipos conocidos", () => {
    expect(isDeletableEntity("lead")).toBe(true);
    expect(isDeletableEntity("cm:abc")).toBe(true);
    expect(isDeletableEntity("task")).toBe(false);
    expect(isDeletableEntity("cm:")).toBe(false);
    expect(isDeletableEntity("user")).toBe(false);
  });
});

describe("getDeletionImpact", () => {
  it("empresa: informa lo que queda sin empresa y el historial que se borra (scopeado por negocio)", async () => {
    counts.company.mockResolvedValue(2);
    counts.contact.mockResolvedValue(3);
    counts.opportunity.mockResolvedValue(1);
    counts.activity.mockResolvedValue(5);
    const r = await getDeletionImpact("biz_A", "company", ["c1", "c2"]);
    expect(r.found).toBe(2);
    expect(r.unlinked.map((i) => i.label)).toEqual(["3 contactos quedan sin empresa", "1 oportunidad queda sin empresa"]);
    expect(r.removed.map((i) => i.label)).toEqual(["5 actividades del historial"]);
    for (const fn of Object.values(counts)) for (const call of fn.mock.calls) expect(call[0].where.businessId).toBe("biz_A");
  });

  it("producto usado en oportunidades: los ítems conservan nombre y precio", async () => {
    counts.customRecord.mockResolvedValue(1);
    counts.opportunityItem.mockResolvedValue(2);
    const r = await getDeletionImpact("biz_A", "cm:mod_1", ["p1"]);
    expect(counts.customRecord.mock.calls[0][0].where).toMatchObject({ businessId: "biz_A", moduleId: "mod_1" });
    expect(r.unlinked[0].label).toContain("conservan su nombre y precio");
  });

  it("oportunidad: sus productos cargados se borran con ella", async () => {
    counts.opportunity.mockResolvedValue(1);
    counts.opportunityItem.mockResolvedValue(4);
    const r = await getDeletionImpact("biz_A", "opportunity", ["o1"]);
    expect(r.removed[0].label).toBe("4 productos o ítems cargados");
  });
});
