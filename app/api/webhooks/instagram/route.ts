import { NextResponse } from "next/server";

import { isValidMetaSignature, safeEqualString } from "@/lib/meta/webhook-signature";
import { formatSummary, summarizeWebhook } from "@/modules/instagram/webhook";

// Webhook PÚBLICO de Instagram (Meta → Nodo). No pasa por la sesión: la
// seguridad es el verify token (GET) y la firma HMAC del cuerpo (POST).
// URL a configurar en Meta: https://<dominio de Nodo>/api/webhooks/instagram
//
// Variables (server-only, nunca NEXT_PUBLIC_*):
// - INSTAGRAM_WEBHOOK_VERIFY_TOKEN: el mismo texto que se carga en Meta.
// - INSTAGRAM_APP_SECRET: "Instagram app secret" de la app Kodexa Connect.
// - META_APP_SECRET (opcional): "App secret" de la app (Configuración →
//   Básica). Se acepta la firma de cualquiera de los dos.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024; // Meta manda lotes chicos; 1 MB de tope.
const LOG = "[webhook/instagram]";

// Verificación de la suscripción (Meta → GET con hub.*).
export async function GET(request: Request) {
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token") ?? "";
  const challenge = sp.get("hub.challenge") ?? "";

  if (!expected) {
    console.error(`${LOG} falta INSTAGRAM_WEBHOOK_VERIFY_TOKEN; verificación rechazada`);
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (mode !== "subscribe" || !safeEqualString(token, expected) || !challenge) {
    console.warn(`${LOG} verificación rechazada (mode o token inválido)`);
    return new NextResponse("Forbidden", { status: 403 });
  }
  // Meta espera el challenge tal cual, como texto plano.
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

// Eventos (Meta → POST firmado). Se valida la firma sobre el cuerpo
// ORIGINAL antes de parsear nada.
export async function POST(request: Request) {
  const secrets = [process.env.INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter((s): s is string => !!s);
  if (secrets.length === 0) {
    console.error(`${LOG} falta INSTAGRAM_APP_SECRET; evento rechazado`);
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  if (!isValidMetaSignature(raw, request.headers.get("x-hub-signature-256"), secrets)) {
    console.warn(`${LOG} firma inválida o ausente; evento descartado`);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    console.warn(`${LOG} cuerpo firmado pero no es JSON válido`);
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Por ahora solo se registra un resumen sin datos personales (tipos y
  // cantidades). No se guardan mensajes ni se crean leads todavía.
  console.info(`${LOG} evento recibido: ${formatSummary(summarizeWebhook(payload))}`);
  return new NextResponse("EVENT_RECEIVED", { status: 200, headers: { "Content-Type": "text/plain" } });
}
