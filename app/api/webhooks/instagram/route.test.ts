import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const BASE = "https://nodo.test/api/webhooks/instagram";
const VERIFY = "verify-token-de-prueba";
const SECRET = "instagram-app-secret-de-prueba";
const META_SECRET = "meta-app-secret-de-prueba";

const sign = (body: string, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const post = (body: string, signature?: string | null) =>
  new Request(BASE, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
    body,
  });

// Payload real de prueba (botón "Test" del panel de Meta): mensaje eco.
const TEST_EVENT = JSON.stringify({
  object: "instagram",
  entry: [
    {
      id: "17841400000000000",
      time: 1760000000,
      messaging: [
        {
          sender: { id: "12334" },
          recipient: { id: "23245" },
          timestamp: "1527459824",
          message: { mid: "random_mid", text: "texto privado del cliente", is_echo: true, is_self: true },
        },
      ],
    },
  ],
});

let logs: string[];
beforeEach(() => {
  vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", VERIFY);
  vi.stubEnv("INSTAGRAM_APP_SECRET", SECRET);
  vi.stubEnv("META_APP_SECRET", "");
  logs = [];
  for (const level of ["info", "warn", "error", "log"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(" ")));
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET — verificación de la suscripción", () => {
  it("devuelve hub.challenge en texto plano si el token coincide", async () => {
    const res = await GET(new Request(`${BASE}?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=1158201444`));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1158201444");
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("rechaza un token incorrecto", async () => {
    const res = await GET(new Request(`${BASE}?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`));
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("1");
  });

  it("rechaza si hub.mode no es subscribe o falta el challenge", async () => {
    expect((await GET(new Request(`${BASE}?hub.mode=unsubscribe&hub.verify_token=${VERIFY}&hub.challenge=1`))).status).toBe(403);
    expect((await GET(new Request(`${BASE}?hub.mode=subscribe&hub.verify_token=${VERIFY}`))).status).toBe(403);
  });

  it("sin INSTAGRAM_WEBHOOK_VERIFY_TOKEN configurado no verifica nada", async () => {
    vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "");
    const res = await GET(new Request(`${BASE}?hub.mode=subscribe&hub.verify_token=&hub.challenge=1`));
    expect(res.status).toBe(403);
  });
});

describe("POST — firma X-Hub-Signature-256", () => {
  it("acepta un evento firmado con el Instagram app secret", async () => {
    const res = await POST(post(TEST_EVENT, sign(TEST_EVENT)));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EVENT_RECEIVED");
  });

  it("acepta también la firma con META_APP_SECRET si está configurado", async () => {
    vi.stubEnv("META_APP_SECRET", META_SECRET);
    expect((await POST(post(TEST_EVENT, sign(TEST_EVENT, META_SECRET)))).status).toBe(200);
  });

  it("rechaza firma ausente, mal formada o de otro secreto", async () => {
    expect((await POST(post(TEST_EVENT, null))).status).toBe(401);
    expect((await POST(post(TEST_EVENT, "sha1=abc"))).status).toBe(401);
    expect((await POST(post(TEST_EVENT, "sha256=zz"))).status).toBe(401);
    expect((await POST(post(TEST_EVENT, sign(TEST_EVENT, "otro-secreto")))).status).toBe(401);
  });

  it("rechaza si el cuerpo fue alterado después de firmar (se firma el cuerpo original)", async () => {
    const signature = sign(TEST_EVENT);
    const tampered = TEST_EVENT.replace("texto privado", "texto cambiado");
    expect((await POST(post(tampered, signature))).status).toBe(401);
    // Mismo JSON con otro formato (espacios) también invalida la firma.
    expect((await POST(post(JSON.stringify(JSON.parse(TEST_EVENT), null, 2), signature))).status).toBe(401);
  });

  it("sin secretos configurados responde 500 y no procesa", async () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    expect((await POST(post(TEST_EVENT, sign(TEST_EVENT)))).status).toBe(500);
  });

  it("cuerpo firmado que no es JSON → 400", async () => {
    expect((await POST(post("no-json", sign("no-json")))).status).toBe(400);
  });

  it("rechaza cuerpos de más de 1 MB", async () => {
    const big = JSON.stringify({ object: "instagram", pad: "x".repeat(1024 * 1024) });
    expect((await POST(post(big, sign(big)))).status).toBe(413);
  });
});

describe("POST — eventos recibidos y logs", () => {
  it("registra un resumen del evento de prueba sin datos personales ni secretos", async () => {
    await POST(post(TEST_EVENT, sign(TEST_EVENT)));
    const line = logs.find((l) => l.includes("evento recibido"));
    expect(line).toBe("[webhook/instagram] evento recibido: object=instagram entries=1 message_echo=1 test=true");
    const all = logs.join("\n");
    for (const sensitive of ["texto privado", "12334", "23245", "random_mid", SECRET, VERIFY]) expect(all).not.toContain(sensitive);
  });

  it("cuenta distintos tipos de evento", async () => {
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        { id: "1", time: 1, messaging: [{ message: { mid: "a", text: "hola" } }, { read: { mid: "a" } }, { reaction: { reaction: "love" } }] },
        { id: "2", time: 2, changes: [{ field: "comments", value: { text: "comentario" } }] },
      ],
    });
    await POST(post(body, sign(body)));
    expect(logs.find((l) => l.includes("evento recibido"))).toBe(
      "[webhook/instagram] evento recibido: object=instagram entries=2 message=1 read=1 reaction=1 change:comments=1"
    );
    expect(logs.join("\n")).not.toContain("hola");
  });

  it("una firma inválida no deja rastro del contenido en los logs", async () => {
    await POST(post(TEST_EVENT, sign(TEST_EVENT, "malo")));
    expect(logs.join("\n")).not.toContain("texto privado");
    expect(logs.some((l) => l.includes("firma inválida"))).toBe(true);
  });
});
