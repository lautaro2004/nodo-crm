-- Módulos personalizados, relaciones entre registros y productos en
-- oportunidades. Ver docs/campos-y-modulos-personalizados.md.
--
-- SOLO schema "crm". 100% aditiva: tablas nuevas y columnas nuevas
-- nullable o con default. No modifica ni borra datos existentes, y no
-- toca "public" ni "nexo". Idempotente (IF NOT EXISTS / duplicate_object)
-- para poder aplicarse también a mano desde el SQL Editor de Supabase.

-- CustomFieldDefinition: campos de módulos personalizados y de relación
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "moduleId" TEXT;
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "targetEntity" TEXT;
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "multiple" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "CustomFieldDefinition_moduleId_idx" ON "crm"."CustomFieldDefinition"("moduleId");

CREATE TABLE IF NOT EXISTS "crm"."CustomModule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelSingular" TEXT NOT NULL,
    "labelPlural" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "priceFieldId" TEXT,
    "imageFieldId" TEXT,
    "codeFieldId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomModule_businessId_key_key" ON "crm"."CustomModule"("businessId", "key");
CREATE INDEX IF NOT EXISTS "CustomModule_businessId_idx" ON "crm"."CustomModule"("businessId");

CREATE TABLE IF NOT EXISTS "crm"."CustomRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomRecord_businessId_moduleId_archivedAt_idx" ON "crm"."CustomRecord"("businessId", "moduleId", "archivedAt");
CREATE INDEX IF NOT EXISTS "CustomRecord_moduleId_title_idx" ON "crm"."CustomRecord"("moduleId", "title");

CREATE TABLE IF NOT EXISTS "crm"."RecordLink" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RecordLink_definitionId_fromId_toId_key" ON "crm"."RecordLink"("definitionId", "fromId", "toId");
CREATE INDEX IF NOT EXISTS "RecordLink_businessId_toType_toId_idx" ON "crm"."RecordLink"("businessId", "toType", "toId");
CREATE INDEX IF NOT EXISTS "RecordLink_businessId_fromType_fromId_idx" ON "crm"."RecordLink"("businessId", "fromType", "fromId");

CREATE TABLE IF NOT EXISTS "crm"."OpportunityItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "recordId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpportunityItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OpportunityItem_opportunityId_idx" ON "crm"."OpportunityItem"("opportunityId");
CREATE INDEX IF NOT EXISTS "OpportunityItem_businessId_recordId_idx" ON "crm"."OpportunityItem"("businessId", "recordId");

-- Claves foráneas (todas dentro de "crm")
DO $$ BEGIN
  ALTER TABLE "crm"."CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "crm"."CustomModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."CustomModule" ADD CONSTRAINT "CustomModule_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."CustomRecord" ADD CONSTRAINT "CustomRecord_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."CustomRecord" ADD CONSTRAINT "CustomRecord_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "crm"."CustomModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."RecordLink" ADD CONSTRAINT "RecordLink_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."RecordLink" ADD CONSTRAINT "RecordLink_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "crm"."CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."OpportunityItem" ADD CONSTRAINT "OpportunityItem_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."OpportunityItem" ADD CONSTRAINT "OpportunityItem_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "crm"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm"."OpportunityItem" ADD CONSTRAINT "OpportunityItem_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "crm"."CustomRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
