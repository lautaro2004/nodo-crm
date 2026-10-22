-- Integraciones de captura de leads (Google Sheets, Instagram).
-- SOLO schema "crm". Aditiva: dos tablas nuevas, sin tocar tablas
-- existentes ni los schemas "public"/"nexo". Idempotente (IF NOT EXISTS)
-- para poder aplicarse también a mano desde el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS "crm"."LeadIntegration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalAccountId" TEXT,
    "externalUsername" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secretEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedById" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadIntegration_type_externalAccountId_key" ON "crm"."LeadIntegration"("type", "externalAccountId");
CREATE INDEX IF NOT EXISTS "LeadIntegration_businessId_type_idx" ON "crm"."LeadIntegration"("businessId", "type");

CREATE TABLE IF NOT EXISTS "crm"."IngestionEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "outcome" TEXT,
    "data" JSONB,
    "error" TEXT,
    "leadId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "IngestionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IngestionEvent_integrationId_externalId_key" ON "crm"."IngestionEvent"("integrationId", "externalId");
CREATE INDEX IF NOT EXISTS "IngestionEvent_businessId_receivedAt_idx" ON "crm"."IngestionEvent"("businessId", "receivedAt");
CREATE INDEX IF NOT EXISTS "IngestionEvent_integrationId_status_receivedAt_idx" ON "crm"."IngestionEvent"("integrationId", "status", "receivedAt");

DO $$ BEGIN
  ALTER TABLE "crm"."LeadIntegration" ADD CONSTRAINT "LeadIntegration_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."IngestionEvent" ADD CONSTRAINT "IngestionEvent_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "crm"."LeadIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
