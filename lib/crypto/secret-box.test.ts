import { afterEach, describe, expect, it, vi } from "vitest";

import { integrationAad, isEncryptionConfigured, openSecret, sealSecret } from "./secret-box";

afterEach(() => vi.unstubAllEnvs());

describe("secret-box", () => {
  it("cifra y descifra con el mismo negocio/integración", () => {
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "a".repeat(64));
    const sealed = sealSecret("token-ig", integrationAad("biz1", "int1"));
    expect(sealed).not.toContain("token-ig");
    expect(openSecret(sealed, integrationAad("biz1", "int1"))).toBe("token-ig");
  });
  it("copiar el valor a otro negocio no permite descifrarlo", () => {
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "b".repeat(64));
    const sealed = sealSecret("token-ig", integrationAad("biz1", "int1"));
    expect(() => openSecret(sealed, integrationAad("biz2", "int1"))).toThrow();
  });
  it("usa GOOGLE_TOKEN_ENCRYPTION_KEY si no hay clave propia; sin ninguna, no está configurado", () => {
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", "");
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "c".repeat(64));
    expect(isEncryptionConfigured()).toBe(true);
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "");
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => sealSecret("x", "y")).toThrow("encryption_not_configured");
  });
});
