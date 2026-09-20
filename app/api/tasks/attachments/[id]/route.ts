import { NextResponse } from "next/server";

import { requireWorkspace, notFound } from "@/lib/api-guard";
import { deleteTaskAttachment, getAttachmentDownloadUrl } from "@/modules/tasks/attachments";

// GET = link de descarga (signed URL de corta duración), no el archivo en
// sí — el cliente hace un segundo request directo a Supabase con ese link.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const url = await getAttachmentDownloadUrl(ctx.businessId, id);
  if (!url) return notFound();
  return NextResponse.json({ url });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteTaskAttachment(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
