-- Mejoras integrales: campos editables, relaciones con cardinalidad,
-- motor genérico de automatizaciones, preferencias de vista por usuario,
-- paneles de Informes y equipos/roles/permisos de Nodo.
--
-- SOLO schema "crm". 100% aditiva: columnas nuevas nullable o con default
-- y tablas nuevas. No modifica ni borra datos existentes y no toca
-- "public" ni "nexo" (Membership/Invitation siguen siendo de Nexo).
-- Idempotente (IF NOT EXISTS / duplicate_object) para poder aplicarse
-- también a mano desde el SQL Editor de Supabase.

ALTER TABLE "crm"."AutomationRule" ADD COLUMN IF NOT EXISTS "module" TEXT;

ALTER TABLE "crm"."AutomationRun" ADD COLUMN IF NOT EXISTS "depth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "crm"."AutomationRun" ADD COLUMN IF NOT EXISTS "details" JSONB;
ALTER TABLE "crm"."AutomationRun" ADD COLUMN IF NOT EXISTS "trigger" TEXT;

ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "defaultValue" TEXT;
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "exclusive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "inverseLabel" TEXT;
ALTER TABLE "crm"."CustomFieldDefinition" ADD COLUMN IF NOT EXISTS "validation" JSONB;

ALTER TABLE "crm"."RecordLink" ADD COLUMN IF NOT EXISTS "exclusiveTo" TEXT;

CREATE TABLE IF NOT EXISTS "crm"."UserPreference" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm"."ReportDashboard" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDashboard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm"."Team" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "leadUserId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm"."TeamMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm"."AccessRole" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm"."MemberAccess" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm"."InvitationAccess" (
    "invitationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationAccess_pkey" PRIMARY KEY ("invitationId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_businessId_userId_key_key" ON "crm"."UserPreference"("businessId", "userId", "key");

CREATE INDEX IF NOT EXISTS "ReportDashboard_businessId_createdBy_idx" ON "crm"."ReportDashboard"("businessId", "createdBy");

CREATE INDEX IF NOT EXISTS "Team_businessId_idx" ON "crm"."Team"("businessId");

CREATE UNIQUE INDEX IF NOT EXISTS "Team_businessId_name_key" ON "crm"."Team"("businessId", "name");

CREATE INDEX IF NOT EXISTS "TeamMember_businessId_userId_idx" ON "crm"."TeamMember"("businessId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_key" ON "crm"."TeamMember"("teamId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "AccessRole_businessId_key_key" ON "crm"."AccessRole"("businessId", "key");

CREATE UNIQUE INDEX IF NOT EXISTS "MemberAccess_businessId_userId_key" ON "crm"."MemberAccess"("businessId", "userId");

CREATE INDEX IF NOT EXISTS "InvitationAccess_businessId_idx" ON "crm"."InvitationAccess"("businessId");

CREATE INDEX IF NOT EXISTS "AutomationRule_businessId_module_enabled_idx" ON "crm"."AutomationRule"("businessId", "module", "enabled");

CREATE INDEX IF NOT EXISTS "AutomationRun_ruleId_createdAt_idx" ON "crm"."AutomationRun"("ruleId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "RecordLink_definitionId_exclusiveTo_key" ON "crm"."RecordLink"("definitionId", "exclusiveTo");

DO $$ BEGIN
  ALTER TABLE "crm"."UserPreference" ADD CONSTRAINT "UserPreference_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."ReportDashboard" ADD CONSTRAINT "ReportDashboard_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."Team" ADD CONSTRAINT "Team_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."Team" ADD CONSTRAINT "Team_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "crm"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "crm"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."AccessRole" ADD CONSTRAINT "AccessRole_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."MemberAccess" ADD CONSTRAINT "MemberAccess_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "crm"."MemberAccess" ADD CONSTRAINT "MemberAccess_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "crm"."AccessRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
