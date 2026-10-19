import { createHmac, timingSafeEqual } from "node:crypto";

// Firma de los webhooks de Meta (Instagram / Messenger / WhatsApp Cloud):
// header `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256 del cuerpo
// ORIGINAL (bytes tal cual llegaron, antes de parsear el JSON) con el App
// Secret. Server-only: los secretos nunca llegan al cliente ni a los logs.

const PREFIX = "sha256=";

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  // Largos distintos → falso sin comparar (timingSafeEqual exige mismo largo).
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

export function computeSignature(rawBody: string | Uint8Array, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * true si la firma coincide con ALGUNO de los secretos dados. Se aceptan
 * varios porque, según cómo esté configurada la app de Meta, Instagram
 * firma con el "Instagram app secret" o con el "App secret" de la app.
 */
export function isValidMetaSignature(rawBody: string | Uint8Array, header: string | null, secrets: (string | undefined)[]) {
  if (!header || !header.startsWith(PREFIX)) return false;
  const received = header.slice(PREFIX.length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(received)) return false;
  return secrets.some((s) => !!s && safeEqualHex(computeSignature(rawBody, s), received));
}

/** Comparación de strings en tiempo constante (ej. verify token). */
export function safeEqualString(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
