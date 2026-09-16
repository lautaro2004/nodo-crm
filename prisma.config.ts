import { config as loadEnv } from "dotenv";
import { defineConfig } from "@prisma/config";

// "dotenv/config" por defecto solo lee ".env" — este proyecto (como Nexo)
// guarda las variables reales en ".env.local" (convención Next.js). Se
// carga explícitamente para que el Prisma CLI (migrate/validate/generate)
// vea DATABASE_URL/DIRECT_URL igual que el runtime de la app.
loadEnv({ path: ".env.local" });

// Mismo patrón que nexo/prisma.config.ts: DIRECT_URL (conexión no pooleada)
// para el CLI (migrate/generate), DATABASE_URL como fallback. En runtime la
// app usa DATABASE_URL vía el adapter (ver lib/prisma.ts) — este archivo
// solo importa para comandos de Prisma CLI.
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
