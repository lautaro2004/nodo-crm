-- Fase 3 (CRM Core): asociación polimórfica etiqueta<->entidad, pospuesta
-- deliberadamente en la Fase 2. Aditivo únicamente — no toca ninguna tabla
-- existente. `Business.logoUrl` (agregado en el schema.prisma de esta
-- fase) NO requiere migración: es una columna física ya existente en la
-- tabla (Nexo la usa), solo se agregó la declaración al modelo espejo.

CREATE TABLE crm."EntityTag" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntityTag_tagId_entityType_entityId_key" ON crm."EntityTag"("tagId", "entityType", "entityId");
CREATE INDEX "EntityTag_businessId_entityType_entityId_idx" ON crm."EntityTag"("businessId", "entityType", "entityId");

ALTER TABLE crm."EntityTag" ADD CONSTRAINT "EntityTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES crm."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
