import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { buildAuthorizeUrl, getInstagramAppConfig } from "@/lib/instagram/graph";
import { createInstagramState, IG_COOKIE_PATH, IG_NONCE_COOKIE } from "@/lib/instagram/oauth-state";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";

// Inicia el OAuth oficial de Instagram (Business Login). Solo owner/admin.
// Usuario y negocio salen de la sesión; el `state` firmado los liga a esta
// operación y el nonce viaja además en una cookie httpOnly.
export async function POST() {
  const { ctx, response } = await requireWorkspace({ admin: "settings" });
  if (!ctx) return response;
  const config = getInstagramAppConfig();
  if (!config) return NextResponse.json({ error: "instagram_not_configured" }, { status: 503 });
  if (!isEncryptionConfigured()) return NextResponse.json({ error: "encryption_not_configured" }, { status: 503 });

  const { state, nonce } = createInstagramState({ userId: ctx.userId, businessId: ctx.businessId });
  const res = NextResponse.json({ url: buildAuthorizeUrl(config, state) });
  res.cookies.set(IG_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: IG_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
