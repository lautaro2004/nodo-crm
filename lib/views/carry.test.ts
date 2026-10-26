import { describe, expect, it } from "vitest";

import { withCarriedParams } from "./carry";

describe("withCarriedParams (aplicar una vista)", () => {
  it("conserva Lista/Kanban, columnas y pipeline si la vista no los define", () => {
    const next = withCarriedParams("owner=me", "display=list&cols=title,stage&pipelineId=p1&owner=all");
    expect(next.get("owner")).toBe("me");
    expect(next.get("display")).toBe("list");
    expect(next.get("cols")).toBe("title,stage");
    expect(next.get("pipelineId")).toBe("p1");
  });

  it("si la vista define la visualización, manda la vista", () => {
    const next = withCarriedParams("display=kanban&status=won", "display=list");
    expect(next.get("display")).toBe("kanban");
  });

  it("no arrastra filtros de la vista anterior", () => {
    const next = withCarriedParams("status=won", "display=list&q=acme&owner=me");
    expect(next.has("q")).toBe(false);
    expect(next.has("owner")).toBe(false);
  });
});
