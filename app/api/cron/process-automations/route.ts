import { NextResponse } from "next/server";

import { processUnattendedLeads } from "@/modules/automations/engine";

// Alertas de leads sin atención. Igual que process-reminders: lo invoca un
// scheduler externo (cada 15-60 min alcanza) con CRON_SECRET. Reintentos o
// ejecuciones solapadas son seguros: cada alerta se registra una sola vez
// por lead y regla (AutomationRun único).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await processUnattendedLeads());
}
