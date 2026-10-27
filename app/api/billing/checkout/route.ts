import { NextResponse } from "next/server";
import { z } from "zod";

import { callNexoBilling } from "@/lib/nexo-billing";
import { resolveBillingActor } from "@/modules/billing/actor";

const bodySchema = z.object({
  planId: z.string().min(1),
  cardTokenId: z.string().min(1),
  interval: z.enum(["month", "year"]).optional(),
  extraUsers: z.coerce.number().int().min(0).max(500).optional(),
  // Combo: plan de Nexo a sumar (descuento sobre la suma de ambos).
  withNexoPlanId: z.string().min(1).optional(),
});

// Contratación desde Nodo. userId y email salen de la sesión; businessId,
// precio y monto NO se aceptan del cliente: Nexo los resuelve y valida. El
// token de tarjeta lo generó Mercado Pago en el navegador (nunca pasa una
// tarjeta cruda por acá) y no se registra en ningún log.
export async function POST(request: Request) {
  const actor = await resolveBillingActor();
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Datos inválidos." }, { status: 400 });

  const { status, data } = await callNexoBilling("checkout", { userId: actor.userId, payerEmail: actor.email, ...parsed.data });
  return NextResponse.json(data, { status });
}
