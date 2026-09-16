import { describe, expect, it, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const membershipFindFirst = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: {
      findFirst: (...args: unknown[]) => membershipFindFirst(...args),
    },
  },
}));

const { getCurrentBusinessId } = await import("./current");

beforeEach(() => {
  getSession.mockReset();
  membershipFindFirst.mockReset();
});

describe("getCurrentBusinessId", () => {
  it("sin sesión, devuelve null sin consultar Membership", async () => {
    getSession.mockResolvedValue(null);

    const result = await getCurrentBusinessId();

    expect(result).toBeNull();
    expect(membershipFindFirst).not.toHaveBeenCalled();
  });

  it("con sesión, resuelve el businessId vía Membership.findFirst({ userId })", async () => {
    getSession.mockResolvedValue({ user: { id: "user_1" } });
    membershipFindFirst.mockResolvedValue({ businessId: "biz_1" });

    const result = await getCurrentBusinessId();

    expect(result).toBe("biz_1");
    expect(membershipFindFirst).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  });

  it("con sesión pero sin Membership, devuelve null", async () => {
    getSession.mockResolvedValue({ user: { id: "user_2" } });
    membershipFindFirst.mockResolvedValue(null);

    const result = await getCurrentBusinessId();

    expect(result).toBeNull();
  });
});
