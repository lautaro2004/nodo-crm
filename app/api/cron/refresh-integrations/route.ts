import { NextResponse } from "next/server";

import { refreshInstagramTokens } from "@/modules/integrations/instagram";

// Renueva los tokens de Instagram que vencen en menos de 10 días (duran 60;
// Meta permite renovar cuando tienen 24 h o más). Lo invoca el scheduler
// externo con CRON_SECRET, igual que los otros cron (una vez por día alcanza).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(await refreshInstagramTokens());
}
