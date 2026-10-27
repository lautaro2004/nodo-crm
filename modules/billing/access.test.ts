import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { nexoSubscription: { findUnique } } }));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));

import { billingEnforcement, computeCrmBillingState, isCrmBlocked } from "@/modules/billing/access";

const now = new Date("2026-10-26T12:00:00Z");
const day = 86_400_000;
const sub = (over: Record<string, unknown> = {}, plan: Record<string, unknown> = {}) => ({
  status: "active",
  provider: "mercadopago",
  currentPeriodEnd: new Date(now.getTime() + 10 * day),
  pastDueSince: null,
  mercadoPagoLastSyncedAt: now,
  billingInterval: "month",
  extraUsers: 0,
  plan: { name: "Nodo 3", products: ["crm"], crmMaxUsers: 3, ...plan },
  ...over,
});

beforeEach(() => findUnique.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("billingEnforcement", () => {
  it("por defecto está apagado", () => {
    expect(billingEnforcement()).toBe("off");
    vi.stubEnv("NODO_BILLING_ENFORCEMENT", "cualquier-cosa");
    expect(billingEnforcement()).toBe("off");
  });
  it("reconoce report y on", () => {
    vi.stubEnv("NODO_BILLING_ENFORCEMENT", "report");
    expect(billingEnforcement()).toBe("report");
    vi.stubEnv("NODO_BILLING_ENFORCEMENT", " ON ");
    expect(billingEnforcement()).toBe("on");
  });
});

describe("computeCrmBillingState / isCrmBlocked", () => {
  it("suscripción activa con Nodo: acceso normal y límite = incluidos + extras", async () => {
    findUnique.mockResolvedValue(sub({ extraUsers: 2 }));
    const state = await computeCrmBillingState("b1", now);
    expect(state.access.access).toBe("full");
    expect(state.seatLimit).toBe(5);
    expect(state.planName).toBe("Nodo 3");
  });
  it("sin suscripción: bloqueado, pero solo se aplica con enforcement on", async () => {
    findUnique.mockResolvedValue(null);
    const state = await computeCrmBillingState("b1", now);
    expect(state.access).toMatchObject({ access: "blocked", reason: "no_subscription" });
    expect(isCrmBlocked(state)).toBe(false); // off
    expect(isCrmBlocked({ ...state, mode: "on" })).toBe(true);
    expect(isCrmBlocked({ ...state, mode: "report" })).toBe(false);
  });
  it("un plan solo de Nexo no habilita Nodo", async () => {
    findUnique.mockResolvedValue(sub({}, { products: ["nexo"], crmMaxUsers: null }));
    const state = await computeCrmBillingState("b1", now);
    expect(state.access).toMatchObject({ access: "blocked", reason: "not_in_plan" });
    expect(state.seatLimit).toBeNull();
  });
  it("pago atrasado: 7 días de gracia con acceso y después bloqueo", async () => {
    findUnique.mockResolvedValue(sub({ status: "past_due", pastDueSince: new Date(now.getTime() - 3 * day) }));
    expect((await computeCrmBillingState("b1", now)).access.access).toBe("grace");
    findUnique.mockResolvedValue(sub({ status: "past_due", pastDueSince: new Date(now.getTime() - 8 * day) }));
    expect((await computeCrmBillingState("b1", now)).access).toMatchObject({ access: "blocked", reason: "past_due_expired" });
  });
  it("al regularizar (active de nuevo) recupera el acceso", async () => {
    findUnique.mockResolvedValue(sub({ status: "active", pastDueSince: null }));
    expect((await computeCrmBillingState("b1", now)).access.access).toBe("full");
  });
});
