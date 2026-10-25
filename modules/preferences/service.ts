import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Preferencias por usuario y negocio (crm.UserPreference). Claves válidas:
//   list:<entityType>   última vista de una lista (query string normalizado)
//   reports:default     id del panel de Informes que se abre por defecto
// Cualquier otra clave se rechaza: el cliente no puede guardar basura.

const KEY_RE = /^(list:(lead|contact|company|opportunity|task|cm:[a-z0-9]{10,40})|reports:default)$/;

export function isValidPreferenceKey(key: string) {
  return KEY_RE.test(key);
}

export async function getPreference<T = unknown>(businessId: string, userId: string, key: string): Promise<T | null> {
  if (!isValidPreferenceKey(key)) return null;
  const row = await prisma.userPreference.findUnique({ where: { businessId_userId_key: { businessId, userId, key } } });
  return (row?.value as T) ?? null;
}

export async function setPreference(businessId: string, userId: string, key: string, value: unknown) {
  if (!isValidPreferenceKey(key)) throw new Error("invalid_input");
  const json = JSON.stringify(value ?? null);
  if (json.length > 4000) throw new Error("invalid_input");
  await prisma.userPreference.upsert({
    where: { businessId_userId_key: { businessId, userId, key } },
    create: { businessId, userId, key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
}
