import { NextResponse } from "next/server";

import { requireWorkspace, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { moduleEntityType } from "@/lib/custom-modules";
import { MAX_FILE_BYTES, recordFileDownloadUrl, removeRecordFile, uploadRecordFile } from "@/modules/records/files";

type Params = { params: Promise<{ id: string; recordId: string; definitionId: string }> };

// Archivo de un campo "file" (ej. documentación de una Colaboración). Mismo
// esquema de permisos que las imágenes: subir/quitar requiere poder editar
// el registro; descargar, poder verlo. Módulo, registro y campo se
// revalidan contra el negocio de la sesión antes de tocar Storage.

export async function GET(_request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId, definitionId } = await params;
  const denied = await requireRecordAccess(ctx, moduleEntityType(id), recordId, "view");
  if (denied) return denied;
  try {
    const url = await recordFileDownloadUrl(ctx.businessId, id, recordId, definitionId);
    if (!url) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Redirección a la URL firmada de 2 minutos (descarga como adjunto).
    return NextResponse.redirect(url, 302);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId, definitionId } = await params;
  const denied = await requireRecordAccess(ctx, moduleEntityType(id), recordId, "edit");
  if (denied) return denied;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: "document_too_large" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadRecordFile(ctx.businessId, id, recordId, definitionId, { bytes, declaredType: file.type, name: file.name });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId, definitionId } = await params;
  const denied = await requireRecordAccess(ctx, moduleEntityType(id), recordId, "edit");
  if (denied) return denied;
  try {
    await removeRecordFile(ctx.businessId, id, recordId, definitionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
