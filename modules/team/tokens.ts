import { createHash, randomBytes } from "node:crypto";

// Token de invitación: 32 bytes aleatorios (base64url) en el link; en la
// base solo el SHA-256 (si alguien lee la tabla no puede usar los links).
export function newInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const INVITATION_TTL_DAYS = 7;
