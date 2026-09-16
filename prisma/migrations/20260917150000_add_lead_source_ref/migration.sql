-- Fase 4 (integración Nexo -> Nodo): agrega el campo de referencia al
-- registro de origen en crm.Lead, y el índice único que garantiza
-- idempotencia (reprocesar el mismo nexo.Appointment nunca crea un
-- segundo Lead). Exclusivamente crm.* — no toca public.* ni nexo.*.
--
-- Columna nueva NULLABLE: las filas existentes (todas con source="manual"
-- por default) quedan con sourceRef = NULL, compatible con el índice único
-- de abajo sin ningún backfill (Postgres no considera dos NULL iguales en
-- un unique index).

ALTER TABLE crm."Lead" ADD COLUMN "sourceRef" TEXT;

CREATE UNIQUE INDEX "Lead_businessId_source_sourceRef_key" ON crm."Lead"("businessId", "source", "sourceRef");
