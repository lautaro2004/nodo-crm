import { describe, expect, it, vi, beforeEach } from "vitest";

const membershipFindMany = vi.fn();
const membershipFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: {
      findMany: (...args: unknown[]) => membershipFindMany(...args),
      findFirst: (...args: unknown[]) => membershipFindFirst(...args),
    },
  },
}));

const { listWorkspaceMembers, assertUserBelongsToBusiness } = await import("./members");

beforeEach(() => {
  membershipFindMany.mockReset();
  membershipFindFirst.mockReset();
});

describe("listWorkspaceMembers", () => {
  it("filtra por businessId y devuelve solo los datos públicos del usuario", async () => {
    membershipFindMany.mockResolvedValue([
      { role: "owner", user: { id: "user_1", name: "Lautaro", email: "lautaro@test.com" } },
    ]);
    const members = await listWorkspaceMembers("biz_1");
    expect(membershipFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz_1" } }));
    expect(members).toEqual([{ userId: "user_1", name: "Lautaro", email: "lautaro@test.com", role: "owner" }]);
  });
});

describe("assertUserBelongsToBusiness", () => {
  it("no lanza si el usuario tiene Membership en ese Business", async () => {
    membershipFindFirst.mockResolvedValue({ id: "membership_1" });
    await expect(assertUserBelongsToBusiness("biz_1", "user_1")).resolves.toBeUndefined();
    expect(membershipFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz_1", userId: "user_1" } }));
  });

  it("lanza 'user_not_in_business' si no hay Membership en ese Business", async () => {
    membershipFindFirst.mockResolvedValue(null);
    await expect(assertUserBelongsToBusiness("biz_1", "user_de_otro_biz")).rejects.toThrow("user_not_in_business");
  });
});
