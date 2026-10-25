import { describe, expect, it, vi } from "vitest";

const teamFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { team: { findMany: (...a: unknown[]) => teamFindMany(...a) } } }));

const { teamUserIdsFor, wouldCreateCycle, scopeOwnerIds, canSeeRecord, defaultOwnerFor } = await import("./service");
import { SYSTEM_ROLES, applyOverrides } from "@/lib/access";

describe("equipos y jerarquía", () => {
  it("impide ciclos (un equipo no depende de sí mismo ni de un sub-equipo)", () => {
    const teams = [
      { id: "dir", parentId: null },
      { id: "ventas", parentId: "dir" },
      { id: "norte", parentId: "ventas" },
    ];
    expect(wouldCreateCycle(teams, "dir", "norte")).toBe(true);
    expect(wouldCreateCycle(teams, "ventas", "ventas")).toBe(true);
    expect(wouldCreateCycle(teams, "norte", "dir")).toBe(false);
    expect(wouldCreateCycle(teams, "norte", null)).toBe(false);
  });

  it("el supervisor ve a su equipo y a TODOS los sub-equipos; un miembro, solo a su equipo", async () => {
    teamFindMany.mockResolvedValue([
      { id: "dir", parentId: null, leadUserId: "jefe", members: [] },
      { id: "ventas", parentId: "dir", leadUserId: "lider", members: [{ userId: "v1" }, { userId: "v2" }] },
      { id: "admin", parentId: "dir", leadUserId: null, members: [{ userId: "a1" }] },
    ]);
    expect((await teamUserIdsFor("b", "jefe")).sort()).toEqual(["a1", "jefe", "lider", "v1", "v2"]);
    expect((await teamUserIdsFor("b", "v1")).sort()).toEqual(["lider", "v1", "v2"]);
  });
});

describe("alcance por registro", () => {
  const base = { userId: "v1", businessId: "b", isOwner: false, roleKey: "member", roleName: "Miembro", teamUserIds: ["v1", "v2"] };
  it("propios: solo sus registros; equipo: los del equipo; todos: sin filtro", () => {
    const own = { ...base, policy: applyOverrides(SYSTEM_ROLES.member.policy, { modules: { lead: { scope: "own" } } }) };
    expect(scopeOwnerIds(own, "lead")).toEqual(["v1"]);
    expect(canSeeRecord(own, "lead", { ownerId: "v2" })).toBe(false);
    expect(canSeeRecord(own, "lead", { ownerId: "v1" })).toBe(true);
    const team = { ...base, policy: applyOverrides(SYSTEM_ROLES.member.policy, { modules: { lead: { scope: "team" } } }) };
    expect(canSeeRecord(team, "lead", { ownerId: "v2" })).toBe(true);
    expect(scopeOwnerIds(team, "contact")).toBeNull();
  });

  it("al crear sin responsable con alcance restringido, queda a nombre de quien crea", () => {
    const own = { ...base, policy: applyOverrides(SYSTEM_ROLES.member.policy, { modules: { lead: { scope: "own" } } }) };
    expect(defaultOwnerFor(own, "lead", null)).toBe("v1");
    expect(defaultOwnerFor(own, "contact", null)).toBeNull();
    expect(defaultOwnerFor(own, "lead", "v2")).toBe("v2");
  });
});
