// Cliente mínimo de la API de Instagram con Instagram Login (Business
// Login). Solo servidor: usa INSTAGRAM_APP_SECRET y tokens de acceso, que
// nunca llegan al navegador ni a los logs.
//
// Referencias (Meta, oct-2026):
// - Autorización: https://www.instagram.com/oauth/authorize
// - Código → token corto: POST https://api.instagram.com/oauth/access_token
// - Token corto → largo (60 días): GET https://graph.instagram.com/access_token
// - Renovación: GET https://graph.instagram.com/refresh_access_token
//   (token de 24 h o más y todavía vigente).
// - Webhooks por cuenta: POST graph.instagram.com/<ver>/<IG_ID>/subscribed_apps

export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"] as const;
export const REQUIRED_SCOPES: readonly string[] = INSTAGRAM_SCOPES;
const GRAPH = "https://graph.instagram.com";
const TIMEOUT_MS = 10_000;

export interface InstagramAppConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphVersion: string;
}

/**
 * Configuración de la app (Kodexa Connect). La URL de callback se puede
 * fijar con INSTAGRAM_REDIRECT_URI; si no, se arma con BETTER_AUTH_URL.
 * Tiene que coincidir EXACTAMENTE con la registrada en Meta.
 */
export function getInstagramAppConfig(): InstagramAppConfig | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const base = process.env.BETTER_AUTH_URL;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || (base ? new URL("/api/integrations/instagram/callback", base).toString() : "");
  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri, graphVersion: process.env.INSTAGRAM_GRAPH_VERSION || "v26.0" };
}

export class InstagramApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    /** Mensaje de Meta, sin datos sensibles (para diagnóstico). */
    public detail?: string
  ) {
    super(code);
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new InstagramApiError("instagram_unreachable", 0);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body.error ?? {}) as Record<string, unknown>;
    const detail = String(err.message ?? body.error_message ?? "").slice(0, 200) || undefined;
    throw new InstagramApiError("instagram_api_error", res.status, detail);
  }
  return body;
}

export function buildAuthorizeUrl(config: InstagramAppConfig, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", state);
  // Solo login con cuenta profesional de Instagram (el permiso de mensajes
  // es de Instagram Login, no de Facebook Login).
  url.searchParams.set("enable_fb_login", "false");
  url.searchParams.set("force_reauth", "true");
  return url.toString();
}

export interface ShortLivedToken {
  accessToken: string;
  userId: string;
  permissions: string[];
}

export async function exchangeCode(config: InstagramAppConfig, code: string): Promise<ShortLivedToken> {
  const form = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    // Meta agrega "#_" al final del código en el redirect.
    code: code.replace(/#_$/, ""),
  });
  const body = await request("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  // Formato actual: { data: [{ access_token, user_id, permissions }] };
  // el anterior devolvía el objeto directo. Se aceptan ambos.
  const item = (Array.isArray(body.data) ? body.data[0] : body) as Record<string, unknown> | undefined;
  const accessToken = typeof item?.access_token === "string" ? item.access_token : null;
  if (!accessToken) throw new InstagramApiError("instagram_token_missing", 502);
  const permissions = Array.isArray(item?.permissions)
    ? (item.permissions as unknown[]).map(String)
    : String(item?.permissions ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
  return { accessToken, userId: String(item?.user_id ?? ""), permissions };
}

export interface LongLivedToken {
  accessToken: string;
  expiresAt: Date;
}

function toLongLived(body: Record<string, unknown>): LongLivedToken {
  const accessToken = typeof body.access_token === "string" ? body.access_token : null;
  if (!accessToken) throw new InstagramApiError("instagram_token_missing", 502);
  const seconds = Number(body.expires_in) > 0 ? Number(body.expires_in) : 60 * 24 * 3600;
  return { accessToken, expiresAt: new Date(Date.now() + seconds * 1000) };
}

export async function exchangeLongLived(config: InstagramAppConfig, shortToken: string): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("access_token", shortToken);
  return toLongLived(await request(url.toString()));
}

export async function refreshLongLived(token: string): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  return toLongLived(await request(url.toString()));
}

export interface InstagramAccount {
  /** ID de la cuenta profesional: es el `entry[].id` de los webhooks. */
  igUserId: string;
  username: string | null;
  name: string | null;
  accountType: string | null;
}

export async function getAccount(config: InstagramAppConfig, token: string): Promise<InstagramAccount> {
  const url = new URL(`${GRAPH}/${config.graphVersion}/me`);
  url.searchParams.set("fields", "user_id,username,name,account_type");
  url.searchParams.set("access_token", token);
  const body = await request(url.toString());
  const igUserId = String(body.user_id ?? body.id ?? "");
  if (!igUserId) throw new InstagramApiError("instagram_account_missing", 502);
  return {
    igUserId,
    username: typeof body.username === "string" ? body.username : null,
    name: typeof body.name === "string" ? body.name : null,
    accountType: typeof body.account_type === "string" ? body.account_type : null,
  };
}

/** Activa los webhooks de mensajes para la cuenta conectada. */
export async function subscribeToMessages(config: InstagramAppConfig, igUserId: string, token: string): Promise<boolean> {
  const url = new URL(`${GRAPH}/${config.graphVersion}/${igUserId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "messages");
  url.searchParams.set("access_token", token);
  const body = await request(url.toString(), { method: "POST" });
  return body.success === true;
}

export async function unsubscribe(config: InstagramAppConfig, igUserId: string, token: string): Promise<void> {
  const url = new URL(`${GRAPH}/${config.graphVersion}/${igUserId}/subscribed_apps`);
  url.searchParams.set("access_token", token);
  await request(url.toString(), { method: "DELETE" });
}

/** Nombre/usuario de quien escribió (si la API lo permite). Nunca lanza. */
export async function getSenderProfile(config: InstagramAppConfig, igsid: string, token: string): Promise<{ name: string | null; username: string | null }> {
  try {
    const url = new URL(`${GRAPH}/${config.graphVersion}/${encodeURIComponent(igsid)}`);
    url.searchParams.set("fields", "name,username");
    url.searchParams.set("access_token", token);
    const body = await request(url.toString());
    return {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : null,
      username: typeof body.username === "string" && body.username.trim() ? body.username.trim().slice(0, 60) : null,
    };
  } catch {
    return { name: null, username: null };
  }
}
