import { describe, expect, it } from "vitest";

import { guessFeminine } from "./record-nouns";

describe("guessFeminine", () => {
  it("concuerda con las etiquetas típicas de los módulos", () => {
    for (const w of ["Oportunidad", "Venta", "Operación", "Cita", "Propiedad", "Reserva"]) expect(guessFeminine(w)).toBe(true);
    for (const w of ["Caso", "Proyecto", "Producto", "Negocio", "Servicio", "Problema", "Plan", "Trato"]) expect(guessFeminine(w)).toBe(false);
  });
});
