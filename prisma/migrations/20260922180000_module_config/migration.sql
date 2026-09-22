CREATE TABLE "crm"."ModuleConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "internalModule" TEXT NOT NULL,
    "labelSingular" TEXT NOT NULL,
    "labelPlural" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuleConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleConfig_businessId_internalModule_key" ON "crm"."ModuleConfig"("businessId", "internalModule");

ALTER TABLE "crm"."ModuleConfig" ADD CONSTRAINT "ModuleConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "crm"."Workspace"("businessId") ON DELETE CASCADE ON UPDATE CASCADE;
