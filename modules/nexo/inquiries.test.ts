import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { inquiry: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

const { listNexoInquiries } = await import("./inquiries");

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
});

describe("listNexoInquiries", () => {
  it("solo trae las sin calificar (null) y las calificadas — nunca pending ni discarded", async () => {
    await listNexoInquiries("biz_A");
    expect(findMany.mock.calls[0][0].where).toEqual({
      businessId: "biz_A",
      OR: [{ qualificationStatus: null }, { qualificationStatus: "qualified" }],
    });
  });

  it("con since, filtra por última actualización (una calificación tardía también entra)", async () => {
    const since = new Date("2026-10-15T00:00:00Z");
    await listNexoInquiries("biz_A", { since });
    expect(findMany.mock.calls[0][0].where.updatedAt).toEqual({ gte: since });
  });
});
