import { describe, expect, it, vi } from "vitest";

const cfFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { customFieldValue: { findMany: (...a: unknown[]) => cfFindMany(...a) } } }));
vi.mock("@/modules/tags/service", () => ({ listEntityIdsForTag: async () => ["l_tag"] }));
vi.mock("@/modules/status-definitions/service", () => ({ getClosedLeadStatusKeys: async () => ["converted", "disqualified"] }));

const { parseLeadFilters, buildLeadWhere } = await import("./filters");

describe("filtros de leads (fuente única para lista, Kanban, vistas, CSV e informes)", () => {
  it("parsea la URL: listas, 'me', fechas y campos personalizados", () => {
    const f = parseLeadFilters(new URLSearchParams("status=new,contacted&ownerId=me&from=2026-10-01&nofollowup=3&open=1&cf.def1=Gold"), "u1");
    expect(f.status).toEqual(["new", "contacted"]);
    expect(f.ownerId).toBe("u1");
    expect(f.noFollowUpDays).toBe(3);
    expect(f.openOnly).toBe(true);
    expect(f.customFields).toEqual([{ definitionId: "def1", value: "Gold" }]);
    expect(f.from?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("combina filtros con AND y siempre scopea por businessId", async () => {
    cfFindMany.mockResolvedValue([{ entityId: "l1" }]);
    const now = new Date("2026-10-17T12:00:00Z");
    const where = await buildLeadWhere("biz", { status: ["new"], ownerId: "none", openOnly: true, noFollowUpDays: 3, tagId: "t1", customFields: [{ definitionId: "def1", value: "Gold" }] }, now);
    expect(where.businessId).toBe("biz");
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { status: { in: ["new"] } },
        { ownerId: null },
        { status: { notIn: ["converted", "disqualified"] } },
        { OR: [{ lastFollowUpAt: null, createdAt: { lt: new Date("2026-10-14T12:00:00Z") } }, { lastFollowUpAt: { lt: new Date("2026-10-14T12:00:00Z") } }] },
        { id: { in: ["l_tag"] } },
        { id: { in: ["l1"] } },
      ])
    );
    // El campo personalizado se busca solo en definiciones de este negocio y de Lead.
    expect(cfFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ definition: { id: "def1", businessId: "biz", entityType: "lead" } }) }));
  });

  it("nofollowup=0 significa 'nunca tuvo seguimiento'", async () => {
    const where = await buildLeadWhere("biz", { noFollowUpDays: 0 });
    expect(where.AND).toEqual([{ lastFollowUpAt: null }]);
  });
});
