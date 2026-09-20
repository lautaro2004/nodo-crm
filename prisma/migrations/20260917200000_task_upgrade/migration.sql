-- Upgrade de crm.Task a unidad de trabajo real (ver
-- docs/architecture/crm-fase-tareas.md). Exclusivamente crm.* — no toca
-- public.* ni nexo.*.
--
-- Verificado antes de escribir esto (solo lectura): 1 sola fila real en
-- crm.Task, con relatedType/relatedId ya en NULL — se puede migrar sin
-- pérdida de datos. El valor de status existente ("pending") se traduce
-- al nuevo vocabulario fijo ("todo") en la misma transacción.

BEGIN;

ALTER TABLE crm."Task"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "contactId" TEXT,
  ADD COLUMN "leadId" TEXT,
  ADD COLUMN "opportunityId" TEXT;

-- Traducción del único valor de status existente ("pending" -> "todo").
-- Cualquier otro valor legado que no sea "pending" queda tal cual (no
-- debería existir ninguno, pero no se fuerza a ciegas).
UPDATE crm."Task" SET "status" = 'todo' WHERE "status" = 'pending';
ALTER TABLE crm."Task" ALTER COLUMN "status" SET DEFAULT 'todo';

-- relatedType/relatedId reemplazados por las 4 FKs explícitas de arriba —
-- confirmado sin datos reales en esas columnas antes de borrarlas.
ALTER TABLE crm."Task" DROP COLUMN "relatedType";
ALTER TABLE crm."Task" DROP COLUMN "relatedId";

CREATE INDEX "Task_businessId_ownerId_idx" ON crm."Task"("businessId", "ownerId");
CREATE INDEX "Task_companyId_idx" ON crm."Task"("companyId");
CREATE INDEX "Task_contactId_idx" ON crm."Task"("contactId");
CREATE INDEX "Task_leadId_idx" ON crm."Task"("leadId");
CREATE INDEX "Task_opportunityId_idx" ON crm."Task"("opportunityId");

ALTER TABLE crm."Task" ADD CONSTRAINT "Task_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES crm."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm."Task" ADD CONSTRAINT "Task_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES crm."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm."Task" ADD CONSTRAINT "Task_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES crm."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm."Task" ADD CONSTRAINT "Task_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES crm."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE crm."TaskAttachment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskAttachment_businessId_idx" ON crm."TaskAttachment"("businessId");
CREATE INDEX "TaskAttachment_taskId_idx" ON crm."TaskAttachment"("taskId");
ALTER TABLE crm."TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES crm."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
