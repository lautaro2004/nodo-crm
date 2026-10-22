import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { safeErrorMessage } from "@/modules/integrations/ingest";
import { ingestNexoInquiry } from "@/modules/nexo/ingest-inquiry";

// Llamada servidor a servidor desde Nexo cuando se guarda una consulta o un
// interesado del asistente (ver en Nexo modules/inquiries/nodo-sync.ts).
// - Autenticación: secreto compartido NEXO_NODO_SYNC_SECRET (mismo valor en
//   ambos sitios), comparado en tiempo constante.
// - El body trae solo ids: los datos se leen de nexo.Inquiry, filtrando por
//   businessId, así que un id de otro negocio no devuelve nada.
// - Si el negocio no tiene Nodo (sin Workspace) responde outcome
//   "no_workspace" y no hace nada.

const bodySchema = z.object({ businessId: z.string().min(1).max(64), inquiryId: z.string().min(1).max(64) });

function authorized(request: Request): boolean {
  const secret = process.env.NEXO_NODO_SYNC_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!process.env.NEXO_NODO_SYNC_SECRET) {
    return NextResponse.json({ error: "NEXO_NODO_SYNC_SECRET no configurado." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const result = await ingestNexoInquiry(parsed.data.businessId, parsed.data.inquiryId);
    if (result.outcome === "not_found") return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });
    return NextResponse.json({ outcome: result.outcome, leadId: "leadId" in result ? result.leadId : null });
  } catch (error) {
    console.error("[nexo-inquiry] Error procesando la consulta:", safeErrorMessage(error));
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
