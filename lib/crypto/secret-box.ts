import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado en reposo de secretos de integraciones (token de Instagram,
// secreto de firma de Google Sheets). AES-256-GCM, mismo formato que
// lib/google/crypto.ts ("v1.<iv>.<tag>.<ciphertext>", base64url).
//
// Clave: INTEGRATIONS_ENCRYPTION_KEY (32 bytes en base64 o 64 hex). Si no
// está, se usa GOOGLE_TOKEN_ENCRYPTION_KEY para no exigir una segunda
// clave donde ya existe una. El AAD liga cada valor a su negocio e
// integración: copiar el texto cifrado a otra fila no permite descifrarlo.

function getKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("encryption_not_configured");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("encryption_key_invalid");
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function sealSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function openSecret(payload: string, aad: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("secret_malformed");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/** AAD de una integración: negocio + id de la integración. */
export function integrationAad(businessId: string, integrationId: string): string {
  return `lead-integration:${businessId}:${integrationId}`;
}
