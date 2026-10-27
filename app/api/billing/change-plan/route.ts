import { NextResponse } from "next/server";
import { z } from "zod";

import { callNexoBilling } from "@/lib/nexo-billing";
import { resolveBillingActor } from "@/modules/billing/actor";

const bodySchema = z.object({
  planId: z.string().min(1),
  extraUsers: z.coerce.number().int().min(0).max(500).optional(),
  // Combo: plan de Nexo a sumar al plan de Nodo elegido (null/ausente = solo Nodo).
  withNexoPlanId: z.string().min(1).optional(),
});

// Cambio de plan de Nodo (solo el dueño). userId sale de la sesión; Nexo
// valida, calcula el precio y actualiza el débito en Mercado Pago.
export async function POST(request: Request) {
  const actor = await resolveBillingActor();
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "Datos inválidos." }, { status: 400 });

  const { status, data } = await callNexoBilling("change-plan", { userId: actor.userId, ...parsed.data });
  return NextResponse.json(data, { status });
}
