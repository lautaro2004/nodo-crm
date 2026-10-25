import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse, notFound } from "@/lib/api-guard";
import { isSystemRoleKey } from "@/lib/access";
import { deleteRole, resetSystemRole, saveRole } from "@/modules/access/service";

const schema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.record(z.string(), z.unknown()),
});

// Editar los permisos predeterminados de un rol (del sistema o propio).
export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { key } = await params;
  const { data, response: badRequest } = await parseBody(request, schema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await saveRole(ctx.businessId, ctx, { ...data, key }));
  } catch (err) {
    return domainErrorResponse(err);
  }
}

// Rol propio: se borra (sus miembros vuelven al rol por defecto).
// Rol del sistema: se restauran sus permisos originales.
export async function DELETE(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { key } = await params;
  try {
    const ok = isSystemRoleKey(key) ? await resetSystemRole(ctx.businessId, ctx, key) : await deleteRole(ctx.businessId, ctx, key);
    return ok ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}
