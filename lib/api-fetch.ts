// fetch() que nunca lanza: ante un fallo de red (sin conexión, timeout,
// servidor caído) devuelve una respuesta 503 con { error: "network_error" }.
//
// Motivo: muchos formularios hacen `setSaving(true); await fetch(...);
// setSaving(false)`. Si fetch lanzaba, el `setSaving(false)` nunca corría y
// el botón quedaba en "Guardando…" para siempre, sin ningún mensaje. Con
// apiFetch el flujo normal de error (`!res.ok` → readApiError) muestra
// "Sin conexión…" y el estado se recupera.
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return new Response(JSON.stringify({ error: "network_error" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
