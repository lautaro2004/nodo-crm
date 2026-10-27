import { NextResponse } from "next/server";
import { z } from "zod";

import { callNexoBilling } from "@/lib/nexo-billing";
import { resolveBillingActor } from "@/modules/billing/actor";

const bodySchema = z.object({
  planId: z.string().min(1),
  interval: z.enum(["month", "year"]).optional(),
  extraUsers: z.coerce.number().int().min(0).max(500).optional(),
});

// Cotización (en pesos) para montar el formulario de tarjeta. El precio sale
// de Nexo; acá solo se reenvía el pedido del dueño.
export async function POST(request: Request) {
  const actor = await resolveBillingActor();
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { status, data } = await callNexoBilling("quote", { userId: actor.userId, ...parsed.data });
  return NextResponse.json(data, { status });
}
