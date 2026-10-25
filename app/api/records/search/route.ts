import { NextResponse } from "next/server";

import { requireWorkspace, forbidden } from "@/lib/api-guard";
import { can, scopeWhere } from "@/modules/access/service";
import { searchRecords } from "@/modules/records/search";
import { signedImageUrls } from "@/modules/records/images";

const TYPE_RE = /^(contact|company|lead|opportunity|task|cm:[a-z0-9]{10,40})$/;

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const sp = new URL(request.url).searchParams;
  const type = sp.get("type") ?? "";
  if (!TYPE_RE.test(type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  // Selectores de relación: solo registros que la persona puede ver.
  if (!can(ctx.access, type, "view")) return forbidden();
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
  const scope = scopeWhere(ctx.access, type, { createdByField: type === "task" || type.startsWith("cm:") ? "createdById" : undefined });
  const results = await searchRecords(ctx.businessId, type, (sp.get("q") ?? "").slice(0, 100), ids, scope);
  // La ruta interna de la imagen nunca sale al cliente: se reemplaza por
  // una URL firmada de corta duración (solo rutas de este negocio).
  const urls = await signedImageUrls(ctx.businessId, results.flatMap((r) => (r.imagePath ? [r.imagePath] : [])));
  return NextResponse.json(
    results.map((r) => ({ id: r.id, label: r.label, sub: r.sub, price: r.price, priceText: r.priceText, imageUrl: r.imagePath ? (urls.get(r.imagePath) ?? null) : null }))
  );
}
