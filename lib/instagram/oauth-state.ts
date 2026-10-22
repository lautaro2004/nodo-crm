import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// `state` del OAuth de Instagram (mismo esquema que lib/google/oauth.ts):
// payload firmado con BETTER_AUTH_SECRET que liga la operación al usuario y
// al negocio de la sesión, con vencimiento de 10 minutos, más un nonce que
// también viaja en una cookie httpOnly (doble validación contra CSRF y
// contra el reuso del enlace en otro navegador).

const STATE_TTL_MS = 10 * 60 * 1000;
export const IG_NONCE_COOKIE = "ig_oauth_nonce";
export const IG_COOKIE_PATH = "/api/integrations/instagram";

export interface InstagramStatePayload {
  n: string;
  uid: string;
  bid: string;
  exp: number;
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("state_secret_not_configured");
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(`instagram:${body}`).digest("base64url");
}

export function createInstagramState(input: { userId: string; businessId: string }) {
  const nonce = randomBytes(16).toString("base64url");
  const payload: InstagramStatePayload = { n: nonce, uid: input.userId, bid: input.businessId, exp: Date.now() + STATE_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { state: `${body}.${sign(body)}`, nonce };
}

export function verifyInstagramState(state: string | null, cookieNonce: string | null, now = Date.now()): InstagramStatePayload | null {
  if (!state || !cookieNonce) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let payload: InstagramStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < now) return null;
  const a = Buffer.from(String(payload.n));
  const b = Buffer.from(cookieNonce);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}
