import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { listTaskAttachments, uploadTaskAttachment } from "@/modules/tasks/attachments";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const attachments = await listTaskAttachments(ctx.businessId, id);
  return NextResponse.json(attachments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo enviado." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const attachment = await uploadTaskAttachment(ctx.businessId, {
      taskId: id,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      uploadedById: ctx.userId,
    });
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "task_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error instanceof Error && (error.message === "file_too_large" || error.message === "file_type_not_allowed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/tasks/[id]/attachments] Error al subir el adjunto:", error);
    return NextResponse.json({ error: "No pudimos subir el archivo. Intentá de nuevo." }, { status: 500 });
  }
}
