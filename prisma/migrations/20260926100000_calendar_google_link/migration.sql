-- Integración Google Calendar (V1): un CalendarEvent puede estar vinculado a un
-- evento del Google Calendar principal de un usuario, y a la Task desde la que
-- se creó. Aditiva: columnas con default/nullable, no toca datos existentes
-- (todos los eventos actuales quedan como provider = 'internal').
ALTER TABLE "crm"."CalendarEvent" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE "crm"."CalendarEvent" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "crm"."CalendarEvent" ADD COLUMN "googleUserId" TEXT;
ALTER TABLE "crm"."CalendarEvent" ADD COLUMN "taskId" TEXT;

CREATE UNIQUE INDEX "CalendarEvent_businessId_googleEventId_key" ON "crm"."CalendarEvent"("businessId", "googleEventId");
CREATE INDEX "CalendarEvent_taskId_idx" ON "crm"."CalendarEvent"("taskId");

ALTER TABLE "crm"."CalendarEvent"
    ADD CONSTRAINT "CalendarEvent_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "crm"."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
