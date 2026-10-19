import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({}) }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: () => ({}) }));
vi.mock("better-auth", () => ({ betterAuth: (o: unknown) => o }));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("trustedOrigins", () => {
  it("normaliza barra final/path y suma las URLs de Netlify y extras", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://nodo.kodexa.ar/");
    vi.stubEnv("URL", "https://nodo.kodexa.ar");
    vi.stubEnv("DEPLOY_PRIME_URL", "https://main--nodo-crm.netlify.app");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://www.nodo.kodexa.ar, basura");
    const { trustedOrigins } = await import("./auth");
    expect(trustedOrigins).toEqual(["https://nodo.kodexa.ar", "https://main--nodo-crm.netlify.app", "https://www.nodo.kodexa.ar"]);
  });

  it("en desarrollo confía en los puertos locales", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3010");
    const { trustedOrigins } = await import("./auth");
    expect(trustedOrigins).toEqual(expect.arrayContaining(["http://localhost:3010", "http://localhost:3000", "http://localhost:3001"]));
  });
});
