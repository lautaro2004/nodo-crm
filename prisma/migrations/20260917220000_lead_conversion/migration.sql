-- Fase 5 — Conversión de Leads (ver
-- docs/architecture/crm-fase5-lead-conversion.md). Exclusivamente crm.* —
-- no toca public.* ni nexo.*.
--
-- Agrega a crm.Lead 3 columnas nuevas (todas nullable, sin default
-- destructivo) para registrar el resultado de una conversión Lead ->
-- Contact -> Opportunity opcional. FKs directas (no polimórficas), mismo
-- criterio que crm.Task. convertedOpportunityId es UNIQUE: cada
-- Opportunity nacida de una conversión tiene, por construcción, un único
-- Lead de origen (una conversión siempre CREA una Opportunity nueva, nunca
-- reutiliza una existente).

BEGIN;

ALTER TABLE crm."Lead"
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "convertedContactId" TEXT,
  ADD COLUMN "convertedOpportunityId" TEXT;

CREATE UNIQUE INDEX "Lead_convertedOpportunityId_key" ON crm."Lead"("convertedOpportunityId");
CREATE INDEX "Lead_convertedContactId_idx" ON crm."Lead"("convertedContactId");

ALTER TABLE crm."Lead" ADD CONSTRAINT "Lead_convertedContactId_fkey"
  FOREIGN KEY ("convertedContactId") REFERENCES crm."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm."Lead" ADD CONSTRAINT "Lead_convertedOpportunityId_fkey"
  FOREIGN KEY ("convertedOpportunityId") REFERENCES crm."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
