// Traduce los errores de Better Auth (código + status HTTP) a mensajes en
// castellano. Better Auth responde en inglés ("Invalid email or password"),
// y antes ese texto llegaba tal cual a la pantalla de login.
//
// Nunca se inventa un éxito: cualquier error no reconocido devuelve un
// mensaje genérico, y el detalle técnico queda en la consola del navegador.

const BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "El email o la contraseña no son correctos.",
  INVALID_PASSWORD: "El email o la contraseña no son correctos.",
  INVALID_EMAIL: "Ingresá un email válido.",
  USER_NOT_FOUND: "El email o la contraseña no son correctos.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese email. Iniciá sesión (es la misma cuenta de Nexo).",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese email. Iniciá sesión (es la misma cuenta de Nexo).",
  PASSWORD_TOO_SHORT: "La contraseña tiene que tener al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  EMAIL_NOT_VERIFIED: "Tenés que verificar tu email antes de iniciar sesión.",
  FAILED_TO_CREATE_USER: "No pudimos crear la cuenta. Probá de nuevo en unos minutos.",
  FAILED_TO_CREATE_SESSION: "No pudimos iniciar la sesión. Probá de nuevo en unos minutos.",
};

export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return "No pudimos procesar la solicitud. Probá de nuevo.";
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  if (error.status === 429) return "Demasiados intentos seguidos. Esperá un minuto y volvé a probar.";
  // "Invalid origin": la URL desde la que se abrió Nodo no coincide con la
  // configurada en el servidor (BETTER_AUTH_URL / orígenes de confianza).
  if (error.status === 403 || /origin/i.test(error.message ?? "")) {
    return "No pudimos validar el acceso desde esta dirección. Entrá desde la URL oficial de Nodo o avisá al administrador.";
  }
  if (error.status && error.status >= 500) return "El servidor no respondió correctamente. Probá de nuevo en unos minutos.";
  return "No pudimos procesar la solicitud. Probá de nuevo.";
}

/** Validación del lado del cliente (el servidor vuelve a validar todo). */
export function validateAuthFields(
  mode: "login" | "registro",
  fields: { email: string; password: string; name: string }
): Partial<Record<"email" | "password" | "name", string>> {
  const errors: Partial<Record<"email" | "password" | "name", string>> = {};
  if (mode === "registro" && !fields.name.trim()) errors.name = "Ingresá tu nombre.";
  const email = fields.email.trim();
  if (!email) errors.email = "Ingresá tu email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Ese email no parece válido.";
  if (!fields.password) errors.password = "Ingresá tu contraseña.";
  // El mínimo solo se exige al crear la cuenta: en el login no se le
  // bloquea el acceso a quien tenga una contraseña previa (cuenta de Nexo).
  else if (mode === "registro" && fields.password.length < 8) errors.password = "Usá al menos 8 caracteres.";
  return errors;
}
