import { NextResponse } from "next/server";

import { requireWorkspace, domainErrorResponse } from "@/lib/api-guard";
import { MAX_IMAGE_BYTES, removeRecordImage, uploadRecordImage } from "@/modules/records/images";

type Params = { params: Promise<{ id: string; recordId: string; definitionId: string }> };

// Subir/reemplazar la imagen de un campo "image". Cualquier miembro que
// puede editar el registro. Módulo, registro y campo se revalidan contra
// el negocio de la sesión en uploadRecordImage antes de tocar Storage.
export async function POST(request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId, definitionId } = await params;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadRecordImage(ctx.businessId, id, recordId, definitionId, { bytes, declaredType: file.type });
    return NextResponse.json({ url: result.url }, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId, definitionId } = await params;
  try {
    await removeRecordImage(ctx.businessId, id, recordId, definitionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
