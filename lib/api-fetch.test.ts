import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api-fetch";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("devuelve la respuesta real cuando hay red", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 201 })));
    const res = await apiFetch("/api/x");
    expect(res.status).toBe(201);
  });

  it("convierte un fallo de red en 503 network_error (sin lanzar)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const res = await apiFetch("/api/x", { method: "POST" });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "network_error" });
  });

  it("respeta las cancelaciones explícitas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("aborted", "AbortError"); }));
    await expect(apiFetch("/api/x")).rejects.toThrow("aborted");
  });
});
