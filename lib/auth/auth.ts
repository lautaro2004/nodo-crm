import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { getPrisma } from "@/lib/prisma";

// Instancia PROPIA de Better Auth (no un servicio compartido) contra las
// MISMAS tablas public.User/Session/Account/Verification que usa Nexo —
// ver docs/architecture/crm-fase2-bootstrap.md, sección B. Config
// deliberadamente idéntica a nexo/lib/auth/auth.ts (mismo
// generateId: false, mismo emailAndPassword) para que el comportamiento de
// autenticación sea indistinguible entre productos.
//
// BETTER_AUTH_SECRET debe ser el MISMO valor que usa Nexo (ver .env.local)
// — no una decisión de esta app, es la precondición de que la identidad
// sea realmente compartida.
// trustedOrigins: Better Auth rechaza (403 "Invalid origin") cualquier
// request cuyo header Origin no coincida con baseURL — y en desarrollo
// local, Next.js corre en el 3000 si está libre, pero salta al 3001 (o al
// que siga libre) si Nexo (o cualquier otra cosa) ya está usando el 3000.
// Con un solo baseURL fijo, quedarse sin loguear cada vez que el puerto
// cambia era cuestión de tiempo — pasó exactamente eso ("Invalid origin:
// http://localhost:3000" con BETTER_AUTH_URL apuntando al 3001). La
// solución no es "elegir un puerto y fijarlo" (el próximo cambio de
// entorno rompe lo mismo) sino confiar explícitamente en ambos puertos de
// desarrollo conocidos, además del que diga la env var — ninguno de los
// dos es secreto ni un riesgo real en local.
const devOrigins = ["http://localhost:3000", "http://localhost:3001"];

// En producción el Origin del navegador tiene que coincidir EXACTO con uno
// de estos (esquema + dominio, sin barra final). Por eso:
// - se normaliza cada URL a su origin (un BETTER_AUTH_URL con "/" final o
//   con path daba "Invalid origin" aunque el dominio fuera el correcto);
// - se suman las URLs que Netlify define solo (URL = dominio principal,
//   DEPLOY_PRIME_URL = el *.netlify.app del deploy), así entrar por el
//   dominio propio o por el de Netlify funciona igual;
// - BETTER_AUTH_TRUSTED_ORIGINS (separados por coma) permite sumar otros
//   dominios (ej. www.) sin tocar código.
function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

export const trustedOrigins = [
  ...new Set(
    [
      process.env.BETTER_AUTH_URL,
      process.env.URL,
      process.env.DEPLOY_PRIME_URL,
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
      ...(process.env.NODE_ENV === "production" ? [] : devOrigins),
    ]
      .map(toOrigin)
      .filter((v): v is string => Boolean(v))
  ),
];

export const auth = betterAuth({
  database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
});
