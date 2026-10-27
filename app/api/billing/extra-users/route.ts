import { NextResponse } from "next/server";
import { z } from "zod";

import { callNexoBilling } from "@/lib/nexo-billing";
import { resolveBillingActor } from "@/modules/billing/actor";

const bodySchema = z.object({ extraUsers: z.coerce.number().int().min(0).max(500) });

// Cambiar los usuarios extra de Nodo (solo el dueño). userId sale de la
// sesión; Nexo calcula el precio, valida que los usuarios actuales entren en
// el nuevo límite y actualiza el débito en Mercado Pago.
export async function POST(request: Request) {
  const actor = await resolveBillingActor();
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "Cantidad inválida." }, { status: 400 });

  const { status, data } = await callNexoBilling("extra-users", { userId: actor.userId, extraUsers: parsed.data.extraUsers });
  return NextResponse.json(data, { status });
}
