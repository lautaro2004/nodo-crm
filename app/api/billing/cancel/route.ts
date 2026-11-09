import { NextResponse } from "next/server";

import { callNexoBilling } from "@/lib/nexo-billing";
import { resolveBillingActor } from "@/modules/billing/actor";

// Baja de la suscripción (solo el dueño). userId sale de la sesión; Nexo
// cancela el débito en Mercado Pago y refleja el estado.
export async function POST() {
  const actor = await resolveBillingActor();
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const { status, data } = await callNexoBilling("cancel", { userId: actor.userId });
  return NextResponse.json(data, { status });
}
