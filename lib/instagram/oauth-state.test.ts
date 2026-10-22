import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInstagramState, verifyInstagramState } from "./oauth-state";

beforeEach(() => vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-sesion"));

describe("state del OAuth de Instagram", () => {
  it("es válido con el nonce de la cookie y conserva usuario y negocio", () => {
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    expect(verifyInstagramState(state, nonce)).toMatchObject({ uid: "u1", bid: "b1" });
  });
  it("rechaza state alterado, nonce distinto, sin cookie y vencido", () => {
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    const [body, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), bid: "b2" })).toString("base64url");
    expect(verifyInstagramState(`${forged}.${sig}`, nonce)).toBeNull();
    expect(verifyInstagramState(state, "otro-nonce")).toBeNull();
    expect(verifyInstagramState(state, null)).toBeNull();
    expect(verifyInstagramState(state, nonce, Date.now() + 11 * 60 * 1000)).toBeNull();
  });
  it("un state firmado con otro secreto no sirve", () => {
    const { state, nonce } = createInstagramState({ userId: "u1", businessId: "b1" });
    vi.stubEnv("BETTER_AUTH_SECRET", "otro");
    expect(verifyInstagramState(state, nonce)).toBeNull();
  });
});
