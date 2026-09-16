import { defineConfig } from "vitest/config";
import path from "node:path";

// Mismo criterio que nexo/vitest.config.mts: config mínima, entorno node,
// sin jsdom (los módulos bajo test acá son lógica de servidor, no
// componentes). Los tests de este proyecto SIEMPRE mockean Prisma (ver
// docs/architecture/crm-fase2-bootstrap.md, sección F) — no hay base de
// staging separada, así que "npm test" nunca toca la base real.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
