import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Mismo patrón que nexo/lib/prisma.ts: driver adapter directo contra
// DATABASE_URL (pooler de Supabase), singleton lazy para no fallar el
// build cuando la env var todavía no está seteada.
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL ?? "",
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    },
    {
      onPoolError: (err) => console.error("[prisma] Error en el pool de conexiones:", err),
      onConnectionError: (err) => console.error("[prisma] Error de conexión individual:", err),
    }
  );
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient();
  }
  return globalThis.__prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
