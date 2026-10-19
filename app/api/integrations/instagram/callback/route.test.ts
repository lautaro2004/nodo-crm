import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ctx: { status: "ok", userId: "u1", businessId: "b1", role: "owner" } as Record<string, unknown>,
  complete: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({ resolveWorkspaceContext: async () => mocks.ctx }));
vi.mock("@/modules/integrations/instagram", () => ({ completeInstagramConnection: mocks.complete }));

import { GET } from "./route";
import { createInstagramState } from "@/lib/instagram/oauth-state";

const BASE = "https://nodo.test";
function call(query: Record<string, string>, nonce?: string) {
  const url = new URL("/api/integrations/instagram/callback", BASE);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return GET(new Request(url, { headers: nonce ? { cookie: `ig_oauth_nonce=${nonce}` } : {} }));
}
const result = (res: Response) => new URL(res.headers.get("location")!).searchParams.get("instagram");

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "secreto");
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("INSTAGRAM_APP_ID", "123");
  vi.stubEnv("INSTAGRAM_APP_SECRET", "s");
  mocks.ctx = { status: "ok", userId: "u1", businessId: "b1", role: "owner" };
  mocks.complete.mockReset();
});

describe("callback OAuth de Instagram", () => {
  it("éxito: valida state + cookie y completa la conexión del negocio de la sesión", async () => {
    mocks.complete.mockResolvedValue({ ok: true, integrationId: "i1", username: "kodexa.it", webhookSubscribed: true, missingScopes: [] });
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    const res = await call({ code: "abc#_", state }, nonce);
    expect(result(res)).toBe("connected");
    expect(mocks.complete).toHaveBeenCalledWith({ businessId: "b1", userId: "u1" }, "abc#_");
    expect(res.headers.get("set-cookie")).toMatch(/ig_oauth_nonce=;/);
  });

  it("CSRF: sin cookie, con otro nonce o state de otro negocio → invalid_state, sin canjear el código", async () => {
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    expect(result(await call({ code: "abc", state }))).toBe("invalid_state");
    expect(result(await call({ code: "abc", state }, "otro"))).toBe("invalid_state");
    const other = createInstagramState({ userId: "u1", businessId: "b2" });
    expect(result(await call({ code: "abc", state: other.state }, other.nonce))).toBe("invalid_state");
    expect(mocks.complete).not.toHaveBeenCalled();
    void nonce;
  });

  it("usuario sin rol de admin → forbidden", async () => {
    mocks.ctx = { ...mocks.ctx, role: "member" };
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    expect(result(await call({ code: "abc", state }, nonce))).toBe("forbidden");
  });

  it("el usuario cancela en Instagram → denied", async () => {
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    expect(result(await call({ error: "access_denied", error_reason: "user_denied", state }, nonce))).toBe("denied");
  });

  it("sin sesión → login", async () => {
    mocks.ctx = { status: "unauthenticated" };
    const res = await call({ code: "abc", state: "x" });
    expect(res.headers.get("location")).toContain("/login");
  });

  it("propaga el motivo de error de la conexión", async () => {
    mocks.complete.mockResolvedValue({ ok: false, reason: "account_linked_elsewhere" });
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    expect(result(await call({ code: "abc", state }, nonce))).toBe("account_linked_elsewhere");
  });
});
