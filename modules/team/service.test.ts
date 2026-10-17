import { describe, expect, it, vi, beforeEach } from "vitest";

const m = {
  workspaceFind: vi.fn(),
  nexoSub: vi.fn(),
  userFind: vi.fn(),
  membershipFindFirst: vi.fn(),
  membershipUpdate: vi.fn(),
  membershipCreate: vi.fn(),
  invUpdateMany: vi.fn(),
  invCreate: vi.fn(),
  invFindUnique: vi.fn(),
  invFindFirst: vi.fn(),
  tx: vi.fn(),
};

const prismaMock = {
  workspace: { findUnique: (...a: unknown[]) => m.workspaceFind(...a) },
  nexoSubscription: { findUnique: (...a: unknown[]) => m.nexoSub(...a) },
  user: { findUnique: (...a: unknown[]) => m.userFind(...a) },
  membership: {
    findFirst: (...a: unknown[]) => m.membershipFindFirst(...a),
    update: (...a: unknown[]) => m.membershipUpdate(...a),
    create: (...a: unknown[]) => m.membershipCreate(...a),
    deleteMany: vi.fn(),
  },
  invitation: {
    updateMany: (...a: unknown[]) => m.invUpdateMany(...a),
    create: (...a: unknown[]) => m.invCreate(...a),
    findUnique: (...a: unknown[]) => m.invFindUnique(...a),
    findFirst: (...a: unknown[]) => m.invFindFirst(...a),
  },
  $transaction: async (fn: unknown) => (typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prismaMock) : Promise.all(fn as unknown[])),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { createInvitation, updateMember, acceptInvitation, getInvitationByToken } = await import("./service");
const { hashInvitationToken } = await import("./tokens");

const OWNER = { userId: "u_owner", role: "owner" as const };
const ADMIN = { userId: "u_admin", role: "admin" as const };
const MEMBER = { userId: "u_member", role: "member" as const };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.workspaceFind.mockResolvedValue({ businessId: "biz" });
  m.nexoSub.mockResolvedValue({ id: "sub" });
  m.userFind.mockResolvedValue(null);
  m.invCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: "inv1", ...data }));
});

describe("invitar", () => {
  it("crea la invitación con el hash del token (nunca el token) y revoca la anterior pendiente", async () => {
    const { token, invitation } = await createInvitation("biz", OWNER, { email: " Ana@Mail.com ", role: "admin", products: ["crm", "nexo"] });
    expect(invitation.email).toBe("ana@mail.com");
    expect(m.invUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "biz", email: "ana@mail.com", acceptedAt: null, revokedAt: null }) }));
    const data = m.invCreate.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("un miembro no invita; un admin no invita admins ni dueños", async () => {
    await expect(createInvitation("biz", MEMBER, { email: "a@b.c", role: "member", products: ["crm"] })).rejects.toThrow("forbidden");
    await expect(createInvitation("biz", ADMIN, { email: "a@b.c", role: "admin", products: ["crm"] })).rejects.toThrow("forbidden");
    await expect(createInvitation("biz", OWNER, { email: "a@b.c", role: "owner", products: ["crm"] })).rejects.toThrow("forbidden");
  });

  it("solo ofrece productos que el negocio tiene (sin Nexo → no se puede dar Nexo)", async () => {
    m.nexoSub.mockResolvedValue(null);
    await expect(createInvitation("biz", OWNER, { email: "a@b.c", role: "member", products: ["nexo"] })).rejects.toThrow("product_not_available");
  });

  it("bloquea emails que ya están en otro negocio o ya son del equipo", async () => {
    m.userFind.mockResolvedValue({ id: "u9" });
    m.membershipFindFirst.mockResolvedValue({ businessId: "otro" });
    await expect(createInvitation("biz", OWNER, { email: "x@y.z", role: "member", products: ["crm"] })).rejects.toThrow("email_in_other_business");
    m.membershipFindFirst.mockResolvedValue({ businessId: "biz" });
    await expect(createInvitation("biz", OWNER, { email: "x@y.z", role: "member", products: ["crm"] })).rejects.toThrow("already_member");
  });
});

describe("gestionar miembros", () => {
  it("nadie se modifica a sí mismo ni a alguien de igual o mayor rango", async () => {
    m.membershipFindFirst.mockResolvedValue({ id: "ms", userId: "u_admin", role: "admin" });
    await expect(updateMember("biz", ADMIN, "ms", { products: ["crm"] })).rejects.toThrow("forbidden");
    m.membershipFindFirst.mockResolvedValue({ id: "ms2", userId: "u_owner", role: "owner" });
    await expect(updateMember("biz", ADMIN, "ms2", { role: "member" })).rejects.toThrow("forbidden");
  });

  it("el dueño cambia productos de un miembro (Nodo ↔ Nexo)", async () => {
    m.membershipFindFirst.mockResolvedValue({ id: "ms3", userId: "u_member", role: "member" });
    await updateMember("biz", OWNER, "ms3", { products: ["nexo"] });
    expect(m.membershipUpdate).toHaveBeenCalledWith({ where: { id: "ms3" }, data: { products: ["nexo"] } });
  });
});

describe("aceptar", () => {
  const pending = (over: object = {}) => ({
    id: "inv1",
    businessId: "biz",
    email: "ana@mail.com",
    role: "member",
    products: ["crm"],
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    business: { name: "Kodexa" },
    invitedBy: { name: "Lautaro" },
    ...over,
  });
  const TOKEN = "t".repeat(43);

  it("estados: inválida, vencida, revocada", async () => {
    m.invFindUnique.mockResolvedValue(null);
    expect((await getInvitationByToken(TOKEN)).status).toBe("invalid");
    m.invFindUnique.mockResolvedValue(pending({ expiresAt: new Date(Date.now() - 1000) }));
    expect((await getInvitationByToken(TOKEN)).status).toBe("expired");
    m.invFindUnique.mockResolvedValue(pending({ revokedAt: new Date() }));
    expect((await getInvitationByToken(TOKEN)).status).toBe("revoked");
  });

  it("exige el mismo email de la invitación", async () => {
    m.invFindUnique.mockResolvedValue(pending());
    await expect(acceptInvitation(TOKEN, { id: "u1", email: "otro@mail.com" })).rejects.toThrow("invitation_wrong_email");
  });

  it("bloquea si el usuario ya pertenece a otro negocio", async () => {
    m.invFindUnique.mockResolvedValue(pending());
    m.membershipFindFirst.mockResolvedValue({ businessId: "otro" });
    await expect(acceptInvitation(TOKEN, { id: "u1", email: "ANA@mail.com" })).rejects.toThrow("email_in_other_business");
    expect(m.membershipCreate).not.toHaveBeenCalled();
  });

  it("crea la membresía con rol y productos, una sola vez (claim atómico)", async () => {
    m.invFindUnique.mockResolvedValue(pending({ products: ["crm", "nexo"] }));
    m.membershipFindFirst.mockResolvedValue(null);
    m.invUpdateMany.mockResolvedValue({ count: 1 });
    await acceptInvitation(TOKEN, { id: "u1", email: "ana@mail.com" });
    expect(m.membershipCreate).toHaveBeenCalledWith({ data: { userId: "u1", businessId: "biz", role: "member", products: ["crm", "nexo"] } });

    m.invUpdateMany.mockResolvedValue({ count: 0 });
    m.membershipCreate.mockReset();
    await expect(acceptInvitation(TOKEN, { id: "u1", email: "ana@mail.com" })).rejects.toThrow("invitation_accepted");
    expect(m.membershipCreate).not.toHaveBeenCalled();
  });
});
