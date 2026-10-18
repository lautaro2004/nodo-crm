import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { searchRecords } from "@/modules/records/search";
import { signedImageUrls } from "@/modules/records/images";

const TYPE_RE = /^(contact|company|lead|opportunity|cm:[a-z0-9]{10,40})$/;

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const sp = new URL(request.url).searchParams;
  const type = sp.get("type") ?? "";
  if (!TYPE_RE.test(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
  const results = await searchRecords(ctx.businessId, type, (sp.get("q") ?? "").slice(0, 100), ids);
  // La ruta interna de la imagen nunca sale al cliente: se reemplaza por
  // una URL firmada de corta duración (solo rutas de este negocio).
  const urls = await signedImageUrls(ctx.businessId, results.flatMap((r) => (r.imagePath ? [r.imagePath] : [])));
  return NextResponse.json(
    results.map((r) => ({ id: r.id, label: r.label, sub: r.sub, price: r.price, priceText: r.priceText, imageUrl: r.imagePath ? (urls.get(r.imagePath) ?? null) : null }))
  );
}
