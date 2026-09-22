import { describe, expect, it, vi, beforeEach } from "vitest";

const notificationCreate = vi.fn();
const notificationFindMany = vi.fn();
const notificationCount = vi.fn();
const notificationUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: (...a: unknown[]) => notificationCreate(...a),
      findMany: (...a: unknown[]) => notificationFindMany(...a),
      count: (...a: unknown[]) => notificationCount(...a),
      updateMany: (...a: unknown[]) => notificationUpdateMany(...a),
    },
  },
}));

const notifications = await import("./service");

beforeEach(() => {
  for (const m of [notificationCreate, notificationFindMany, notificationCount, notificationUpdateMany]) m.mockReset();
});

describe("notifications", () => {
  it("9. crea siempre para el (businessId, userId) del destinatario indicado", async () => {
    notificationCreate.mockResolvedValue({ id: "n1" });
    await notifications.createNotification("biz-a", "u1", { type: "reminder", title: "T", body: "B", resourceHref: "/x" });
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({ businessId: "biz-a", userId: "u1", type: "reminder", title: "T", body: "B", resourceHref: "/x" });
  });

  it("lista y cuenta no leídas acotado por negocio + usuario", async () => {
    notificationFindMany.mockResolvedValue([]);
    await notifications.listNotifications("biz-a", "u1");
    expect(notificationFindMany.mock.calls[0][0].where).toEqual({ businessId: "biz-a", userId: "u1" });

    notificationCount.mockResolvedValue(3);
    expect(await notifications.countUnread("biz-a", "u1")).toBe(3);
    expect(notificationCount.mock.calls[0][0].where).toEqual({ businessId: "biz-a", userId: "u1", readAt: null });
  });

  it("marcar leída no permite tocar la de otro usuario/negocio", async () => {
    notificationUpdateMany.mockResolvedValue({ count: 0 });
    expect(await notifications.markRead("biz-b", "u2", "n-de-a")).toBe(false);
    expect(notificationUpdateMany.mock.calls[0][0].where).toEqual({ id: "n-de-a", businessId: "biz-b", userId: "u2", readAt: null });

    notificationUpdateMany.mockResolvedValue({ count: 1 });
    expect(await notifications.markRead("biz-a", "u1", "n1")).toBe(true);
  });

  it("marcar todas leídas queda acotado a (businessId, userId)", async () => {
    notificationUpdateMany.mockResolvedValue({ count: 2 });
    await notifications.markAllRead("biz-a", "u1");
    expect(notificationUpdateMany.mock.calls[0][0].where).toEqual({ businessId: "biz-a", userId: "u1", readAt: null });
  });
});
