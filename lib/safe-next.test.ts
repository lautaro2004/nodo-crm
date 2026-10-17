import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("acepta rutas internas", () => expect(safeNext("/invitacion/abc")).toBe("/invitacion/abc"));
  it("rechaza URLs externas y trucos", () => {
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
