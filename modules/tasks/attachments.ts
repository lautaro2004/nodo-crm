import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createActivity } from "@/modules/activities/service";

// Bucket PRIVADO, propio de Nodo — nunca se mezcla con los buckets de
// Nexo. Nunca se guarda una URL pública ni el binario en Postgres, solo
// el path (storagePath); el acceso siempre pasa por una signed URL de
// corta duración generada bajo demanda (ver getAttachmentDownloadUrl).
export const TASK_ATTACHMENTS_BUCKET = "task-attachments";
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const SIGNED_URL_TTL_SECONDS = 120;

// PDF/DOCX/XLSX/imágenes/ZIP — lo pedido explícitamente, nada más. Un
// adjunto de tarea no es un espacio de archivos genérico.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

let bucketEnsured = false;

// Idempotente y perezoso — se crea la primera vez que alguien sube un
// archivo real, no como paso separado de infraestructura. Si el bucket ya
// existe (por ejemplo, creado a mano desde el dashboard de Supabase), no
// hace nada.
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`No pudimos verificar Supabase Storage: ${listError.message}`);

  if (!buckets.some((b) => b.name === TASK_ATTACHMENTS_BUCKET)) {
    const { error } = await supabase.storage.createBucket(TASK_ATTACHMENTS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    if (error) throw new Error(`No pudimos crear el bucket de adjuntos: ${error.message}`);
  }
  bucketEnsured = true;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

// {businessId}/{taskId}/{uuid}-{nombre} — mismo criterio de aislamiento
// por negocio que ya usa Nexo (payment-proofs, site-assets): la
// estructura de carpetas por sí sola ya separa un negocio de otro dentro
// del bucket, además del scoping por businessId en cada query a Postgres.
function buildAttachmentPath(businessId: string, taskId: string, fileName: string): string {
  return `${businessId}/${taskId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

async function assertTaskBelongsToBusiness(businessId: string, taskId: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId }, select: { id: true } });
  if (!task) throw new Error("task_not_found");
}

export interface UploadTaskAttachmentInput {
  taskId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedById: string | null;
}

export async function uploadTaskAttachment(businessId: string, input: UploadTaskAttachmentInput) {
  if (input.bytes.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("file_too_large");
  }
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error("file_type_not_allowed");
  }
  await assertTaskBelongsToBusiness(businessId, input.taskId);
  await ensureBucket();

  const path = buildAttachmentPath(businessId, input.taskId, input.fileName);
  const { error: uploadError } = await getSupabaseAdmin()
    .storage.from(TASK_ATTACHMENTS_BUCKET)
    .upload(path, input.bytes, { contentType: input.mimeType, upsert: false });
  if (uploadError) throw new Error(`No pudimos subir el archivo: ${uploadError.message}`);

  const attachment = await prisma.taskAttachment.create({
    data: {
      businessId,
      taskId: input.taskId,
      fileName: input.fileName,
      storagePath: path,
      mimeType: input.mimeType,
      fileSizeBytes: input.bytes.byteLength,
      uploadedById: input.uploadedById,
    },
  });

  await createActivity(businessId, {
    relatedType: "task",
    relatedId: input.taskId,
    type: "attachment_added",
    body: input.fileName,
    ownerId: input.uploadedById,
  });

  return attachment;
}

export async function listTaskAttachments(businessId: string, taskId: string) {
  return prisma.taskAttachment.findMany({
    where: { businessId, taskId },
    orderBy: { createdAt: "desc" },
  });
}

// Scopeado por businessId ADEMÁS del id del adjunto — un id real de otro
// negocio nunca matchea, mismo criterio que el resto del proyecto.
export async function getAttachmentDownloadUrl(businessId: string, attachmentId: string): Promise<string | null> {
  const attachment = await prisma.taskAttachment.findFirst({ where: { id: attachmentId, businessId } });
  if (!attachment) return null;

  const { data, error } = await getSupabaseAdmin()
    .storage.from(TASK_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS, { download: attachment.fileName });
  if (error || !data) throw new Error(error?.message ?? "No pudimos generar el link de descarga.");
  return data.signedUrl;
}

export async function deleteTaskAttachment(businessId: string, attachmentId: string): Promise<boolean> {
  const attachment = await prisma.taskAttachment.findFirst({ where: { id: attachmentId, businessId } });
  if (!attachment) return false;

  const { error } = await getSupabaseAdmin().storage.from(TASK_ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
  if (error) throw new Error(error.message);

  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  return true;
}
