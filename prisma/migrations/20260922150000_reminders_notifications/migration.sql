CREATE TABLE "crm"."Reminder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "activityId" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reminder_businessId_status_remindAt_idx" ON "crm"."Reminder"("businessId", "status", "remindAt");
CREATE INDEX "Reminder_userId_idx" ON "crm"."Reminder"("userId");
CREATE INDEX "Reminder_taskId_idx" ON "crm"."Reminder"("taskId");
CREATE INDEX "Reminder_activityId_idx" ON "crm"."Reminder"("activityId");

ALTER TABLE "crm"."Reminder" ADD CONSTRAINT "Reminder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm"."Reminder" ADD CONSTRAINT "Reminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "crm"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm"."Reminder" ADD CONSTRAINT "Reminder_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "crm"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "crm"."Notification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resourceHref" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_businessId_userId_readAt_idx" ON "crm"."Notification"("businessId", "userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "crm"."Notification"("userId", "createdAt");

ALTER TABLE "crm"."Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
