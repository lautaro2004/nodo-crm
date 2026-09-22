import { NextResponse } from "next/server";

import { processDueReminders } from "@/modules/reminders/service";

// Sin infraestructura de cron propia (mismo criterio que
// nexo/app/api/cron/*): este endpoint queda preparado para que un
// scheduler externo (Vercel Cron, cron-job.org, GitHub Actions, etc.) lo
// invoque cada 1-5 minutos. Protegido con CRON_SECRET: sin la variable
// configurada, el endpoint queda inutilizable en vez de abierto.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const result = await processDueReminders();
  return NextResponse.json(result);
}
