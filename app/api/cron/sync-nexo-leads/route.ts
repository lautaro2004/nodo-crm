import { NextResponse } from "next/server";

import { syncLeadsFromNexoForAllWorkspaces } from "@/modules/nexo/sync-leads";

// Sincronización automática Nexo → Nodo (turnos y consultas, incluidas las
// detectadas por WhatsApp). Mismo patrón que los demás app/api/cron/*:
// invocado por un scheduler externo (ver .github/workflows/sync-nexo-leads.yml),
// protegido con CRON_SECRET — sin la variable, inutilizable en vez de
// abierto. Idempotente: correrlo de más nunca duplica Leads.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const result = await syncLeadsFromNexoForAllWorkspaces();
  return NextResponse.json(result);
}
