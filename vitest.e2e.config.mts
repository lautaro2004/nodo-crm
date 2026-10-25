import { defineConfig } from "vitest/config";
import path from "node:path";

// Pruebas E2E de servicios contra un Postgres REAL (nunca la base de
// producción): `DATABASE_URL=postgresql://…/nodo_e2e npx vitest run --config vitest.e2e.config.mts`.
// La base tiene que tener aplicado el schema completo (prisma migrate diff
// --from-empty + migraciones de crm). No corren con `npm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: { environment: "node", include: ["test/e2e/**/*.e2e.ts"], fileParallelism: false, testTimeout: 30_000 },
});
