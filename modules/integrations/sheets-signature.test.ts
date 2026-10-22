import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { signSheetsBody, verifySheetsSignature, sheetsPayloadSchema } from "./sheets";

const SECRET = "secreto-de-prueba";
const BODY = JSON.stringify({ rows: [{ rowId: "r1", values: { Nombre: "Ana" } }] });
const NOW = 1_800_000_000_000;

describe("firma de Google Sheets", () => {
  it("acepta una firma válida y reciente (ms o s)", () => {
    const ts = String(NOW);
    expect(verifySheetsSignature(SECRET, BODY, ts, signSheetsBody(SECRET, ts, BODY), NOW)).toBe("ok");
    const tsS = String(NOW / 1000);
    expect(verifySheetsSignature(SECRET, BODY, tsS, `sha256=${signSheetsBody(SECRET, tsS, BODY)}`, NOW)).toBe("ok");
  });
  it("rechaza otro secreto, cuerpo alterado, firma ausente y timestamps viejos (replay)", () => {
    const ts = String(NOW);
    const sig = signSheetsBody(SECRET, ts, BODY);
    expect(verifySheetsSignature("otro", BODY, ts, sig, NOW)).toBe("invalid");
    expect(verifySheetsSignature(SECRET, BODY.replace("Ana", "Eva"), ts, sig, NOW)).toBe("invalid");
    expect(verifySheetsSignature(SECRET, BODY, null, sig, NOW)).toBe("missing");
    expect(verifySheetsSignature(SECRET, BODY, ts, sig, NOW + 6 * 60 * 1000)).toBe("expired");
  });
  it("valida la estructura y los límites del payload", () => {
    expect(sheetsPayloadSchema.safeParse(JSON.parse(BODY)).success).toBe(true);
    const many = { rows: Array.from({ length: 51 }, (_, i) => ({ rowId: `r${i}`, values: {} })) };
    expect(sheetsPayloadSchema.safeParse(many).success).toBe(false);
    expect(sheetsPayloadSchema.safeParse({ rows: [{ rowId: "", values: {} }] }).success).toBe(false);
  });
});
