CREATE TABLE "crm"."CalendarEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'meeting',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarEvent_businessId_startsAt_idx" ON "crm"."CalendarEvent"("businessId", "startsAt");
CREATE INDEX "CalendarEvent_businessId_ownerId_idx" ON "crm"."CalendarEvent"("businessId", "ownerId");
CREATE INDEX "CalendarEvent_companyId_idx" ON "crm"."CalendarEvent"("companyId");
CREATE INDEX "CalendarEvent_contactId_idx" ON "crm"."CalendarEvent"("contactId");
CREATE INDEX "CalendarEvent_leadId_idx" ON "crm"."CalendarEvent"("leadId");
CREATE INDEX "CalendarEvent_opportunityId_idx" ON "crm"."CalendarEvent"("opportunityId");

ALTER TABLE "crm"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "crm"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm"."CalendarEvent" ADD CONSTRAINT "CalendarEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crm"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
