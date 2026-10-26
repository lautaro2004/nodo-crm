import { describe, expect, it } from "vitest";

import { actionSchema, ACTION_LABELS } from "./workflow-config";

describe("acción send_email", () => {
  it("acepta destinatario del registro, campo, responsable o fijo", () => {
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "record" }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "owner" }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "field", field: "cf_mail" }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "fixed", address: "ventas@x.com" }).success).toBe(true);
  });

  it("exige plantilla, campo o dirección según el destinatario", () => {
    expect(actionSchema.safeParse({ type: "send_email", templateId: "", to: "owner" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "field" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "fixed" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "send_email", templateId: "t1", to: "fixed", address: "no-es-mail" }).success).toBe(false);
  });

  it("tiene etiqueta para el constructor", () => {
    expect(ACTION_LABELS.send_email).toBe("Enviar un email");
  });
});
