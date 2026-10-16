import { describe, expect, it } from "vitest";

import { STATUS_COLOR_KEYS, STATUS_COLORS, resolveStatusColorKey, stageColorKey } from "./status-colors";

describe("paleta de estados", () => {
  it("tiene exactamente 10 colores distintos", () => {
    expect(STATUS_COLOR_KEYS).toHaveLength(10);
    expect(new Set(Object.values(STATUS_COLORS).map((c) => c.hex)).size).toBe(10);
  });

  it("resuelve claves nuevas tal cual", () => {
    expect(resolveStatusColorKey("emerald")).toBe("emerald");
  });

  it("mapea los hex legacy de los templates sin reescribir datos", () => {
    expect(resolveStatusColorKey("#64748b")).toBe("slate");
    expect(resolveStatusColorKey("#0ea5e9")).toBe("sky");
    expect(resolveStatusColorKey("#22C55E")).toBe("emerald");
    expect(resolveStatusColorKey("#6366f1")).toBe("violet");
    expect(resolveStatusColorKey("#ef4444")).toBe("red");
  });

  it("valores desconocidos o vacíos caen en neutro", () => {
    expect(resolveStatusColorKey(null)).toBe("slate");
    expect(resolveStatusColorKey("#123456")).toBe("slate");
    expect(resolveStatusColorKey("fucsia")).toBe("slate");
  });

  it("etapas sin color: Ganado verde, Perdido rojo, resto gris; un color explícito gana", () => {
    expect(stageColorKey({ isWon: true })).toBe("emerald");
    expect(stageColorKey({ isLost: true })).toBe("red");
    expect(stageColorKey({})).toBe("slate");
    expect(stageColorKey({ isWon: true, color: "teal" })).toBe("teal");
  });
});
