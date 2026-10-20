import { describe, expect, it } from "vitest";

import { APPS_SCRIPT_FUNCTIONS, APPS_SCRIPT_SECRET_PROPERTY, buildAppsScript } from "./apps-script";

const code = buildAppsScript({ endpoint: "https://nodo.test/api/integrations/sheets/abc/ingest", integrationName: "Form */ web" });

describe("Apps Script generado", () => {
  it("es JavaScript válido", () => {
    expect(() => new Function(code)).not.toThrow();
  });
  it("solo expone NodoCRM y funciones con prefijo nodoCRM_ (no choca con otros scripts)", () => {
    const globals = [...code.matchAll(/^(?:function|var|let|const)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    expect(globals.sort()).toEqual(["NodoCRM", ...Object.values(APPS_SCRIPT_FUNCTIONS)].sort());
    for (const name of globals) expect(name === "NodoCRM" || name.startsWith("nodoCRM_")).toBe(true);
  });
  it("lee el secreto de la propiedad del script (nunca embebido) y usa la URL de la integración", () => {
    expect(code).toContain(`propiedadSecreto: "${APPS_SCRIPT_SECRET_PROPERTY}"`);
    expect(code).toContain('url: "https://nodo.test/api/integrations/sheets/abc/ingest"');
  });
  it("un nombre de integración con */ no rompe el comentario", () => {
    expect(code).not.toContain("Form */ web");
  });
});
