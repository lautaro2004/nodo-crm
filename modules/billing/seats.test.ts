import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { memberCount, inviteCount, loadState } = vi.hoisted(() => ({
  memberCount: vi.fn(),
  inviteCount: vi.fn(),
  loadState: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { membership: { count: memberCount }, invitation: { count: inviteCount } } }));
vi.mock("@/modules/billing/access", () => ({ loadCrmBillingState: loadState }));

import { assertCrmSeatAvailable } from "@/modules/billing/seats";

beforeEach(() => {
  memberCount.mockReset();
  inviteCount.mockReset();
  loadState.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("assertCrmSeatAvailable", () => {
  it("no hace nada si el cobro no está en modo on", async () => {
    loadState.mockResolvedValue({ mode: "report", seatLimit: 1 });
    await expect(assertCrmSeatAvailable("b1")).resolves.toBeUndefined();
    expect(memberCount).not.toHaveBeenCalled();
  });
  it("sin límite definido no bloquea", async () => {
    loadState.mockResolvedValue({ mode: "on", seatLimit: null });
    await expect(assertCrmSeatAvailable("b1")).resolves.toBeUndefined();
  });
  it("permite sumar si queda lugar (miembros + invitaciones pendientes)", async () => {
    loadState.mockResolvedValue({ mode: "on", seatLimit: 3 });
    memberCount.mockResolvedValue(1);
    inviteCount.mockResolvedValue(1);
    await expect(assertCrmSeatAvailable("b1")).resolves.toBeUndefined();
  });
  it("rechaza cuando las invitaciones pendientes ya ocupan el último lugar", async () => {
    loadState.mockResolvedValue({ mode: "on", seatLimit: 3 });
    memberCount.mockResolvedValue(2);
    inviteCount.mockResolvedValue(1);
    await expect(assertCrmSeatAvailable("b1")).rejects.toThrow("seat_limit_reached");
  });
  it("al aceptar una invitación no cuenta la propia", async () => {
    loadState.mockResolvedValue({ mode: "on", seatLimit: 3 });
    memberCount.mockResolvedValue(2);
    inviteCount.mockResolvedValue(0);
    await expect(assertCrmSeatAvailable("b1", "inv1")).resolves.toBeUndefined();
    expect(inviteCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { not: "inv1" } }) }));
  });
});
