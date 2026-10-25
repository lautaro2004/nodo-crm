import { describe, expect, it } from "vitest";

import { OWNER_POLICY, SYSTEM_ROLES, applyOverrides, canAdmin, canDo, modulePermission, normalizeOverrides, normalizePolicy } from "./access";

describe("permisos de Nodo", () => {
  it("miembro: ve, crea y edita, pero no elimina (comportamiento previo)", () => {
    const p = SYSTEM_ROLES.member.policy;
    expect(canDo(p, "lead", "view")).toBe(true);
    expect(canDo(p, "lead", "edit")).toBe(true);
    expect(canDo(p, "lead", "delete")).toBe(false);
    expect(canAdmin(p, "fields")).toBe(false);
  });

  it("solo lectura no puede crear, editar, eliminar ni exportar en ningún módulo, tampoco en los personalizados", () => {
    const p = SYSTEM_ROLES.viewer.policy;
    for (const m of ["lead", "contact", "cm:abc123defg456"]) {
      expect(canDo(p, m, "view")).toBe(true);
      expect(canDo(p, m, "create") || canDo(p, m, "edit") || canDo(p, m, "delete") || canDo(p, m, "export")).toBe(false);
    }
  });

  it("una excepción por usuario habilita eliminar leads sin cambiar el rol", () => {
    const p = applyOverrides(SYSTEM_ROLES.member.policy, { modules: { lead: { delete: true } } });
    expect(canDo(p, "lead", "delete")).toBe(true);
    expect(canDo(p, "contact", "delete")).toBe(false);
  });

  it("sin «ver» no queda ninguna otra acción (normalización)", () => {
    const p = normalizePolicy({ modules: { "*": { view: false, edit: true, delete: true, export: true, create: true, scope: "all" } } });
    expect(modulePermission(p, "lead")).toMatchObject({ view: false, edit: false, delete: false, create: false, export: false });
  });

  it("descarta claves y valores inválidos que lleguen del cliente", () => {
    expect(normalizeOverrides({ modules: { lead: { delete: "sí", scope: "todo", view: true } }, admin: { fields: 1, team: true } })).toEqual({ modules: { lead: { view: true } } });
    const p = normalizePolicy({ modules: { "DROP TABLE;": { view: true } }, admin: { hack: true } }, OWNER_POLICY);
    expect(Object.keys(p.modules)).toEqual(["*"]);
  });
});
