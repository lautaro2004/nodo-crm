import { describe, expect, it, vi, beforeEach } from "vitest";

const activityCreate = vi.fn();
const leadUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { activity: { create: (...a: unknown[]) => activityCreate(...a) }, lead: { updateMany: (...a: unknown[]) => leadUpdateMany(...a) } },
}));

const { createActivity, isFollowUp } = await import("./service");

beforeEach(() => {
  activityCreate.mockReset();
  leadUpdateMany.mockReset();
});

describe("seguimiento real de leads", () => {
  it("una llamada registrada por una persona actualiza lastFollowUpAt (scopeado por negocio)", async () => {
    const at = new Date("2026-10-17T10:00:00Z");
    activityCreate.mockResolvedValue({ id: "a1", createdAt: at });
    await createActivity("biz", { relatedType: "lead", relatedId: "l1", type: "call", ownerId: "u1" });
    expect(leadUpdateMany).toHaveBeenCalledWith({ where: { id: "l1", businessId: "biz" }, data: { lastFollowUpAt: at } });
  });

  it("eventos automáticos o cambios de estado NO cuentan como atención", async () => {
    activityCreate.mockResolvedValue({ id: "a1", createdAt: new Date() });
    await createActivity("biz", { relatedType: "lead", relatedId: "l1", type: "note", body: "Lead creado" });
    await createActivity("biz", { relatedType: "lead", relatedId: "l1", type: "status_change", ownerId: "u1" });
    await createActivity("biz", { relatedType: "lead", relatedId: "l1", type: "assigned", ownerId: "u1" });
    expect(leadUpdateMany).not.toHaveBeenCalled();
  });

  it("isFollowUp", () => {
    expect(isFollowUp({ type: "email", ownerId: "u1" })).toBe(true);
    expect(isFollowUp({ type: "email", ownerId: null })).toBe(false);
  });
});
