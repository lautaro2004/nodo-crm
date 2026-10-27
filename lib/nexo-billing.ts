// Cliente de la API interna de facturación de Nexo (Nexo es dueño del cobro:
// Mercado Pago, suscripciones, webhooks). Nodo nunca habla con Mercado Pago
// para cobrar ni crea suscripciones: le pide a Nexo, autenticado con el
// secreto compartido NODO_BILLING_SECRET. Solo servidor.
export interface NexoCall {
  status: number;
  data: Record<string, unknown>;
}

export async function callNexoBilling(path: "quote" | "checkout", body: Record<string, unknown>): Promise<NexoCall> {
  const base = process.env.NEXO_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.NODO_BILLING_SECRET;
  if (!base || !secret) {
    return { status: 503, data: { error: "NOT_CONFIGURED", message: "La contratación online todavía no está configurada." } };
  }
  try {
    const res = await fetch(`${base}/api/internal/nodo/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(path === "checkout" ? 45_000 : 10_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch (error) {
    console.error(`[billing] No se pudo contactar a Nexo (${path}):`, error instanceof Error ? error.message : error);
    return { status: 502, data: { error: "NEXO_UNREACHABLE", message: "No pudimos comunicarnos con el servicio de cobro. Probá de nuevo en unos minutos." } };
  }
}
