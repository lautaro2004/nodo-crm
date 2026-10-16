-- Colores configurables para etapas de pipeline (paleta de 10 colores,
-- ver lib/status-colors.ts). Aditiva y nullable: no toca datos existentes;
-- las etapas actuales quedan sin color y la UI usa un default de lectura
-- (Ganado = verde, Perdido = rojo, resto = gris). StatusDefinition ya tenía
-- columna "color" desde init_crm_core, no necesita migración.
ALTER TABLE "crm"."PipelineStage" ADD COLUMN "color" TEXT;
