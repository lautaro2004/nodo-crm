import { describe, expect, it } from "vitest";

import { authErrorMessage, validateAuthFields } from "./auth-errors";

describe("authErrorMessage", () => {
  it("traduce credenciales inválidas", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401, message: "Invalid email or password" })).toBe(
      "El email o la contraseña no son correctos."
    );
  });
  it("cuenta existente en registro", () => {
    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS", status: 422 })).toMatch(/Ya existe una cuenta/);
  });
  it("rate limit, origen inválido y error de servidor", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Demasiados intentos/);
    expect(authErrorMessage({ status: 403, message: "Invalid origin" })).toMatch(/URL oficial/);
    expect(authErrorMessage({ status: 500 })).toMatch(/servidor/);
  });
  it("nunca devuelve el texto en inglés de Better Auth", () => {
    expect(authErrorMessage({ code: "ALGO_NUEVO", status: 400, message: "Something odd" })).toBe("No pudimos procesar la solicitud. Probá de nuevo.");
    expect(authErrorMessage(null)).toMatch(/No pudimos/);
  });
});

describe("validateAuthFields", () => {
  it("exige email y contraseña en el login", () => {
    expect(validateAuthFields("login", { email: "", password: "", name: "" })).toEqual({
      email: "Ingresá tu email.",
      password: "Ingresá tu contraseña.",
    });
  });
  it("valida el formato del email", () => {
    expect(validateAuthFields("login", { email: "foo", password: "x", name: "" }).email).toMatch(/no parece válido/);
  });
  it("no bloquea contraseñas cortas existentes en el login", () => {
    expect(validateAuthFields("login", { email: "a@b.co", password: "123", name: "" })).toEqual({});
  });
  it("en el registro exige nombre y 8 caracteres", () => {
    expect(validateAuthFields("registro", { email: "a@b.co", password: "123", name: " " })).toEqual({
      name: "Ingresá tu nombre.",
      password: "Usá al menos 8 caracteres.",
    });
  });
});
