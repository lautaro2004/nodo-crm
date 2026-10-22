import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseSheetsConfig } from "@/modules/integrations/config";
import {
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_MINUTE,
  leadCustomFields,
  loadSheetsIntegration,
  processSheetsRow,
  recentEventCount,
  sheetsPayloadSchema,
  sheetsSecret,
  verifySheetsSignature,
  type RowResult,
} from "@/modules/integrations/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG = "[integrations/sheets]";

// Endpoint público para el Apps Script de la planilla del cliente.
// Autenticación propia de la integración: firma HMAC-SHA256 con el secreto
// de ESA integración + timestamp (anti-replay). El negocio sale de la
// integración, nunca del cuerpo. Las respuestas no revelan si un id existe.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  if (!/^[a-z0-9]{8,40}$/i.test(id)) return unauthorized();
  const integration = await loadSheetsIntegration(id);
  const secret = integration ? sheetsSecret(integration) : null;
  if (!integration || !secret || integration.status === "disconnected") return unauthorized();

  const check = verifySheetsSignature(secret, raw, request.headers.get("x-nodo-timestamp"), request.headers.get("x-nodo-signature"));
  if (check !== "ok") {
    console.warn(`${LOG} firma rechazada (${check}) para ${integration.id}`);
    return check === "expired" ? NextResponse.json({ error: "signature_expired" }, { status: 401 }) : unauthorized();
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = sheetsPayloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const payload = parsed.data;

  // Prueba de conexión: guarda encabezados y nombre de la hoja (sin filas).
  if (payload.test) {
    const config = parseSheetsConfig(integration.config);
    const next = {
      ...config,
      headers: payload.headers ?? config.headers,
      spreadsheetName: payload.spreadsheetName ?? config.spreadsheetName ?? null,
      sheetName: payload.sheetName ?? config.sheetName ?? null,
      lastTestAt: new Date().toISOString(),
    };
    await prisma.leadIntegration.update({
      where: { id: integration.id },
      data: { config: next as Prisma.InputJsonValue, lastEventAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: integration.status, mapped: Object.values(config.mapping).filter((t) => t !== "ignore").length });
  }

  if (integration.status !== "active") {
    return NextResponse.json({ error: integration.status === "paused" ? "integration_paused" : "integration_not_active" }, { status: 409 });
  }
  const rows = payload.rows ?? [];
  if (!rows.length) return NextResponse.json({ results: [] });

  if ((await recentEventCount(integration.id)) + rows.length > RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const customFields = await leadCustomFields(integration.businessId);
  const results: RowResult[] = [];
  for (const row of rows) results.push(await processSheetsRow(integration, row, customFields));

  const count = (s: RowResult["status"]) => results.filter((r) => r.status === s).length;
  console.log(`${LOG} ${integration.id}: ${rows.length} filas · ok=${count("processed")} dup=${count("duplicate")} error=${count("failed")}`);
  // 200 aunque alguna fila falle: el detalle va por fila, y el script
  // marca cada una para reintentar solo las que fallaron.
  return NextResponse.json({ results });
}
