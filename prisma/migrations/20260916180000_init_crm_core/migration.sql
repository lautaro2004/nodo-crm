-- ============================================================================
-- CRM Fase 2 — primera migración real del CRM: modelos Core dentro del
-- schema `crm` (ya existía vacío, creado en la Fase 3 de Nexo).
--
-- Exclusivamente aditivo: CREATE TABLE nuevas, ninguna sentencia toca
-- `public.*` ni `nexo.*`. No hay ningún ALTER TABLE sobre tablas
-- existentes de Nexo. Workspace.businessId referencia public."Business"
-- (cross-schema FK); el resto de las tablas de este archivo referencian
-- crm."Workspace"("businessId") en vez de public."Business" directo, a
-- propósito (ver comentario en prisma/schema.prisma) — exige que exista un
-- Workspace antes de poder crear cualquier dato de CRM para ese negocio.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS crm;

CREATE TABLE crm."Workspace" (
    "businessId" TEXT NOT NULL,
    "industryTemplate" TEXT,
    "activeModules" TEXT[] NOT NULL DEFAULT '{}',
    "onboardingStep" TEXT,
    "defaultPipelineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("businessId")
);

ALTER TABLE crm."Workspace" ADD CONSTRAINT "Workspace_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES public."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."Pipeline" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Pipeline_businessId_idx" ON crm."Pipeline"("businessId");
ALTER TABLE crm."Pipeline" ADD CONSTRAINT "Pipeline_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PipelineStage_pipelineId_key_key" ON crm."PipelineStage"("pipelineId", "key");
ALTER TABLE crm."PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES crm."Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."Company" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Company_businessId_idx" ON crm."Company"("businessId");
ALTER TABLE crm."Company" ADD CONSTRAINT "Company_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."Contact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Contact_businessId_idx" ON crm."Contact"("businessId");
CREATE INDEX "Contact_companyId_idx" ON crm."Contact"("companyId");
ALTER TABLE crm."Contact" ADD CONSTRAINT "Contact_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE crm."Contact" ADD CONSTRAINT "Contact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES crm."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE crm."Lead" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lead_businessId_idx" ON crm."Lead"("businessId");
ALTER TABLE crm."Lead" ADD CONSTRAINT "Lead_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE crm."Lead" ADD CONSTRAINT "Lead_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES crm."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE crm."Opportunity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Opportunity_businessId_idx" ON crm."Opportunity"("businessId");
ALTER TABLE crm."Opportunity" ADD CONSTRAINT "Opportunity_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE crm."Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES crm."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm."Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES crm."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm."Opportunity" ADD CONSTRAINT "Opportunity_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES crm."Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE crm."Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES crm."PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE crm."Task" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Task_businessId_idx" ON crm."Task"("businessId");
ALTER TABLE crm."Task" ADD CONSTRAINT "Task_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."Activity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerId" TEXT,
    "relatedType" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Activity_businessId_idx" ON crm."Activity"("businessId");
CREATE INDEX "Activity_relatedType_relatedId_idx" ON crm."Activity"("relatedType", "relatedId");
ALTER TABLE crm."Activity" ADD CONSTRAINT "Activity_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."StatusDefinition" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StatusDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatusDefinition_businessId_entityType_key_key" ON crm."StatusDefinition"("businessId", "entityType", "key");
ALTER TABLE crm."StatusDefinition" ADD CONSTRAINT "StatusDefinition_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT[] NOT NULL DEFAULT '{}',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomFieldDefinition_businessId_entityType_key_key" ON crm."CustomFieldDefinition"("businessId", "entityType", "key");
ALTER TABLE crm."CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."CustomFieldValue" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomFieldValue_definitionId_entityId_key" ON crm."CustomFieldValue"("definitionId", "entityId");
ALTER TABLE crm."CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES crm."CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE crm."Tag" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_businessId_name_key" ON crm."Tag"("businessId", "name");
ALTER TABLE crm."Tag" ADD CONSTRAINT "Tag_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES crm."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
