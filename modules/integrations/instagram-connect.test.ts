import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  leadIntegration: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { completeInstagramConnection } from "./instagram";
import { integrationAad, openSecret } from "@/lib/crypto/secret-box";

type Route = { match: RegExp; body: unknown; status?: number };
let routes: Route[];
let calls: string[];

beforeEach(() => {
  vi.stubEnv("INSTAGRAM_APP_ID", "app123");
  vi.stubEnv("INSTAGRAM_APP_SECRET", "appsecret");
  vi.stubEnv("BETTER_AUTH_URL", "https://nodo.test");
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "d".repeat(64));
  calls = [];
  routes = [
    { match: /api\.instagram\.com\/oauth\/access_token/, body: { data: [{ access_token: "SHORT", user_id: "999", permissions: "instagram_business_basic,instagram_business_manage_messages" }] } },
    { match: /graph\.instagram\.com\/access_token/, body: { access_token: "LONG", token_type: "bearer", expires_in: 5183944 } },
    { match: /\/me\?/, body: { user_id: "17841438485232577", username: "kodexa.it", name: "Kodexa" } },
    { match: /subscribed_apps/, body: { success: true } },
  ];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    const r = routes.find((x) => x.match.test(url));
    return new Response(JSON.stringify(r?.body ?? {}), { status: r?.status ?? (r ? 200 : 404) });
  }));
  for (const fn of Object.values(db.leadIntegration)) fn.mockReset();
  db.leadIntegration.findFirst.mockResolvedValue(null);
  db.leadIntegration.create.mockImplementation(async ({ data }) => ({ id: "int1", ...data }));
  db.leadIntegration.update.mockImplementation(async ({ data }) => data);
});

describe("completeInstagramConnection", () => {
  it("canjea el código en el servidor, guarda el token largo cifrado y activa webhooks", async () => {
    const r = await completeInstagramConnection({ businessId: "b1", userId: "u1" }, "CODE#_");
    expect(r).toMatchObject({ ok: true, username: "kodexa.it", webhookSubscribed: true });
    const exchange = calls.find((c) => c.includes("oauth/access_token"))!;
    expect(exchange.startsWith("POST")).toBe(true);
    const saved = db.leadIntegration.update.mock.calls.at(-1)![0].data;
    expect(saved.externalAccountId).toBe("17841438485232577");
    expect(saved.status).toBe("active");
    expect(saved.secretEnc).not.toContain("LONG");
    expect(openSecret(saved.secretEnc, integrationAad("b1", "int1"))).toBe("LONG");
    expect(calls.some((c) => c.startsWith("POST") && c.includes("/17841438485232577/subscribed_apps"))).toBe(true);
  });

  it("sin permiso de mensajes no guarda nada", async () => {
    routes[0].body = { data: [{ access_token: "SHORT", user_id: "999", permissions: "instagram_business_basic" }] };
    const r = await completeInstagramConnection({ businessId: "b1", userId: "u1" }, "CODE");
    expect(r).toEqual({ ok: false, reason: "missing_permissions" });
    expect(db.leadIntegration.update).not.toHaveBeenCalled();
    expect(db.leadIntegration.create).not.toHaveBeenCalled();
  });

  it("una cuenta ya vinculada a OTRO negocio se rechaza", async () => {
    db.leadIntegration.findFirst.mockResolvedValueOnce({ id: "otra", status: "active" });
    const r = await completeInstagramConnection({ businessId: "b1", userId: "u1" }, "CODE");
    expect(r).toEqual({ ok: false, reason: "account_linked_elsewhere" });
    expect(db.leadIntegration.update).not.toHaveBeenCalled();
  });

  it("si Meta no activa los webhooks queda con error visible (no se finge éxito)", async () => {
    routes[3] = { match: /subscribed_apps/, body: { error: { message: "no permission" } }, status: 400 };
    const r = await completeInstagramConnection({ businessId: "b1", userId: "u1" }, "CODE");
    expect(r).toMatchObject({ ok: true, webhookSubscribed: false });
    expect(db.leadIntegration.update.mock.calls.at(-1)![0].data.status).toBe("error");
  });

  it("código rechazado por Meta", async () => {
    routes[0] = { match: /oauth\/access_token/, body: { error_type: "OAuthException", code: 400, error_message: "invalid code" }, status: 400 };
    expect(await completeInstagramConnection({ businessId: "b1", userId: "u1" }, "CODE")).toEqual({ ok: false, reason: "token_exchange_failed" });
  });
});
