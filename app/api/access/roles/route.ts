import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { saveRole } from "@/modules/access/service";

const roleSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  description: z.string().trim().max(200).optional().nullable(),
  // Se normaliza en el servidor (normalizePolicy): claves desconocidas se descartan.
  permissions: z.record(z.string(), z.unknown()),
});

// Crear un rol personalizado.
export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, roleSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await saveRole(ctx.businessId, ctx, { ...data, key: null }), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
