import { describe, expect, it } from "vitest";

import { isModuleEntityType, moduleEntityType, moduleIdFromEntityType, MODULE_TEMPLATES, slugifyModuleKey } from "./custom-modules";
import { customModuleImportDef, applyMapping } from "@/modules/import/shared";

describe("módulos personalizados — utilidades", () => {
  it("entityType estable cm:<id>", () => {
    expect(moduleEntityType("abc123")).toBe("cm:abc123");
    expect(isModuleEntityType("cm:abc123")).toBe(true);
    expect(isModuleEntityType("cm:")).toBe(false);
    expect(isModuleEntityType("lead")).toBe(false);
    expect(moduleIdFromEntityType("cm:abc123")).toBe("abc123");
    expect(moduleIdFromEntityType("contact")).toBeNull();
  });

  it("key de URL a partir del nombre", () => {
    expect(slugifyModuleKey("Productos de Limpieza")).toBe("productos-de-limpieza");
    expect(slugifyModuleKey("Ñandú & Cía")).toBe("nandu-cia");
    expect(slugifyModuleKey("¡¡!!")).toBe("modulo");
  });

  it("las plantillas son opcionales y la de Productos trae precio, imagen y código", () => {
    const productos = MODULE_TEMPLATES.find((t) => t.id === "productos")!;
    expect(productos.fields.map((f) => f.role).filter(Boolean).sort()).toEqual(["code", "image", "price"]);
  });

  it("importación: 'Nombre' del archivo → título del registro", () => {
    const def = customModuleImportDef({ id: "m1", labelPlural: "Productos", labelSingular: "Producto" });
    expect(def.entityType).toBe("cm:m1");
    const result = applyMapping({ Producto: "Taladro" }, [{ column: "Producto", target: { kind: "standard", fieldKey: "name" } }], def, new Map());
    expect(result.standard).toEqual({ name: "Taladro" });
    expect(result.errors).toEqual([]);
  });
});
