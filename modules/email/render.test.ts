import { describe, expect, it } from "vitest";

import { escapeHtml, findVariables, renderTemplate } from "./render";

describe("renderTemplate", () => {
  it("resuelve las 4 variables iniciales", () => {
    const { output, unresolved } = renderTemplate(
      "Hola {{contact.name}} de {{company.name}} ({{lead.name}} / {{opportunity.name}})",
      { "contact.name": "Ana", "company.name": "Acme", "lead.name": "Lead X", "opportunity.name": "Proyecto" }
    );
    expect(output).toBe("Hola Ana de Acme (Lead X / Proyecto)");
    expect(unresolved).toEqual([]);
  });

  it("tolera espacios dentro de las llaves", () => {
    expect(renderTemplate("Hola {{ contact.name }}", { "contact.name": "Ana" }).output).toBe("Hola Ana");
  });

  it("deja literal y reporta variables sin dato o desconocidas", () => {
    const { output, unresolved } = renderTemplate("{{contact.name}} {{lead.name}} {{foo.bar}}", { "contact.name": "Ana" });
    expect(output).toBe("Ana {{lead.name}} {{foo.bar}}");
    expect(unresolved.sort()).toEqual(["foo.bar", "lead.name"]);
  });

  it("escapa HTML en los valores insertados en el cuerpo, no en el asunto", () => {
    const evil = { "contact.name": '<script>alert("x")</script>' };
    expect(renderTemplate("<p>{{contact.name}}</p>", evil, { html: true }).output).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>"
    );
    expect(renderTemplate("{{contact.name}}", evil).output).toBe('<script>alert("x")</script>');
  });

  it("no reinterpreta variables dentro de un valor", () => {
    const { output } = renderTemplate("{{contact.name}}", { "contact.name": "{{company.name}}", "company.name": "Otra" });
    expect(output).toBe("{{company.name}}");
  });

  it("findVariables y escapeHtml", () => {
    expect(findVariables("a {{contact.name}} b {{contact.name}} {{x.y}}").sort()).toEqual(["contact.name", "x.y"]);
    expect(escapeHtml("<&>'\"")).toBe("&lt;&amp;&gt;&#39;&quot;");
  });
});
