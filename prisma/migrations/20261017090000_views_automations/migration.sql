-- Vistas guardadas, automatizaciones y seguimiento de leads.
-- SOLO schema "crm". Aditiva: columnas nuevas nullable o con default,
-- tablas nuevas. No modifica ni borra datos de "public" ni "nexo".
-- Idempotente (IF NOT EXISTS) para poder aplicarse también a mano desde
-- el SQL Editor de Supabase.

-- Lead: seguimiento real + motivo del estado
ALTER TABLE "crm"."Lead" ADD COLUMN IF NOT EXISTS "lastFollowUpAt" TIMESTAMP(3);
ALTER TABLE "crm"."Lead" ADD COLUMN IF NOT EXISTS "statusReason" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_businessId_status_idx" ON "crm"."Lead"("businessId", "status");

-- Backfill de lastFollowUpAt desde el historial existente: solo
-- actividades de seguimiento registradas por una persona (ownerId no
-- nulo). Las automáticas ("Lead creado", sync de Nexo) no cuentan.
UPDATE "crm"."Lead" l
SET "lastFollowUpAt" = a."last"
FROM (
  SELECT "relatedId", MAX("createdAt") AS "last"
  FROM "crm"."Activity"
  WHERE "relatedType" = 'lead'
    AND "ownerId" IS NOT NULL
    AND "type" IN ('call', 'email', 'meeting', 'note', 'comment', 'event_completed')
  GROUP BY "relatedId"
) a
WHERE a."relatedId" = l."id" AND l."lastFollowUpAt" IS NULL;

-- StatusDefinition: campos obligatorios en transición + estado de rechazo
ALTER TABLE "crm"."StatusDefinition" ADD COLUMN IF NOT EXISTS "requiresReason" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "crm"."StatusDefinition" ADD COLUMN IF NOT EXISTS "reasonOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "crm"."StatusDefinition" ADD COLUMN IF NOT EXISTS "isRejection" BOOLEAN NOT NULL DEFAULT false;
-- El estado "Descartado" que siembran los templates queda marcado como
-- rechazo (no exige motivo hasta que el Workspace lo active).
UPDATE "crm"."StatusDefinition" SET "isRejection" = true
WHERE "entityType" = 'lead' AND "key" = 'disqualified' AND "isRejection" = false;

-- Vistas guardadas
CREATE TABLE IF NOT EXISTS "crm"."SavedView" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedView_businessId_entityType_idx" ON "crm"."SavedView"("businessId", "entityType");

-- Reglas de automatización
CREATE TABLE IF NOT EXISTS "crm"."AutomationRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AutomationRule_businessId_type_enabled_idx" ON "crm"."AutomationRule"("businessId", "type", "enabled");

-- Registro de ejecuciones (dedupe por regla + evento)
CREATE TABLE IF NOT EXISTS "crm"."AutomationRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationRun_ruleId_dedupeKey_key" ON "crm"."AutomationRun"("ruleId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "AutomationRun_businessId_createdAt_idx" ON "crm"."AutomationRun"("businessId", "createdAt");

-- Claves foráneas (solo dentro de "crm")
DO $$ BEGIN
  ALTER TABLE "crm"."SavedView" ADD CONSTRAINT "SavedView_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."AutomationRule" ADD CONSTRAINT "AutomationRule_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "crm"."AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
