import { NextResponse } from "next/server";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { canAdminister, resolveAccess } from "@/modules/access/service";
import { getInstagramAppConfig } from "@/lib/instagram/graph";
import { IG_COOKIE_PATH, IG_NONCE_COOKIE, verifyInstagramState } from "@/lib/instagram/oauth-state";
import { completeInstagramConnection } from "@/modules/integrations/instagram";

export const dynamic = "force-dynamic";

const RETURN_TO = "/dashboard/configuracion/integraciones";

// Callback del OAuth de Instagram. Valida, en este orden: sesión de Nodo,
// rol, state firmado + nonce de la cookie (CSRF), que el state sea de ESTE
// usuario y negocio, y la respuesta de Meta. El código se cambia por el
// token en el servidor; el navegador nunca ve ni el token ni el secreto.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = getInstagramAppConfig();
  const base = config ? new URL(config.redirectUri).origin : url.origin;

  const done = (result: string) => {
    const target = new URL(RETURN_TO, base);
    target.searchParams.set("instagram", result);
    const res = NextResponse.redirect(target);
    res.cookies.set(IG_NONCE_COOKIE, "", { path: IG_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  const ctx = await resolveWorkspaceContext();
  if (ctx.status === "unauthenticated") return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(RETURN_TO)}`, base));
  if (ctx.status !== "ok") return done("no_workspace");
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return done("forbidden");

  const cookieNonce = request.headers.get("cookie")?.match(new RegExp(`${IG_NONCE_COOKIE}=([^;]+)`))?.[1] ?? null;
  const state = verifyInstagramState(url.searchParams.get("state"), cookieNonce);
  if (!state || state.uid !== ctx.userId || state.bid !== ctx.businessId) return done("invalid_state");

  // Usuario canceló o Meta devolvió un error.
  if (url.searchParams.get("error")) {
    return done(url.searchParams.get("error_reason") === "user_denied" ? "denied" : "meta_error");
  }
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return done("missing_code");

  const result = await completeInstagramConnection({ businessId: ctx.businessId, userId: ctx.userId }, code);
  if (!result.ok) return done(result.reason);
  return done(result.webhookSubscribed ? "connected" : "connected_no_webhook");
}
