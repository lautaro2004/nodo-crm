import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { moduleEntityType } from "@/lib/custom-modules";
import { setCustomFieldValue } from "@/modules/custom-fields/service";
import { isPathOfBusiness } from "@/modules/records/images";

// Archivos de los campos "file" de módulos personalizados (ej. la
// documentación de una Colaboración). Mismo mecanismo que las imágenes
// (modules/records/images.ts):
//
// - Bucket PRIVADO "record-files", cliente service-role server-only, bucket
//   creado perezosamente.
// - Ruta {businessId}/{moduleId}/{recordId}/{definitionId}-{uuid}/{nombre}:
//   la carpeta separa negocios y módulos, y el último segmento conserva el
//   nombre original (sanitizado) para mostrarlo y descargarlo con su nombre,
//   sin columnas nuevas. En la base solo se guarda la ruta.
// - Se descarga con una URL firmada de 2 minutos con Content-Disposition
//   "attachment": el navegador nunca lo abre inline, así un archivo con
//   contenido HTML no puede ejecutarse en el dominio de Storage.

export const RECORD_FILES_BUCKET = "record-files";
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB, igual que los adjuntos de tareas
const DOWNLOAD_TTL_SECONDS = 120;

// Misma lista que los adjuntos de tareas (modules/tasks/attachments.ts):
// documentos de oficina, PDF, imágenes y ZIP. Nada ejecutable ni HTML/SVG.
const MIME_EXT: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
};
export const ALLOWED_FILE_TYPES = Object.keys(MIME_EXT);
export const ALLOWED_FILE_EXTENSIONS = Array.from(new Set(Object.values(MIME_EXT).flat()));

let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`No pudimos verificar Supabase Storage: ${listError.message}`);
  if (!buckets.some((b) => b.name === RECORD_FILES_BUCKET)) {
    const { error } = await supabase.storage.createBucket(RECORD_FILES_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: ALLOWED_FILE_TYPES,
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(`No pudimos crear el bucket de archivos: ${error.message}`);
  }
  bucketEnsured = true;
}

/** Nombre seguro para el último segmento de la ruta (sin carpetas ni caracteres raros). */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "archivo";
  const cleaned = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(-120);
  return cleaned || "archivo";
}

/** Nombre original para mostrar, a partir de la ruta guardada. */
export function fileNameFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const last = path.split("/").pop();
  return last || null;
}

/**
 * Tipo y extensión tienen que coincidir con la lista permitida. Los PDF,
 * imágenes y ZIP/DOCX/XLSX se verifican además por firma (magic bytes); los
 * DOC/XLS viejos (formato OLE) también. Así no entra un HTML renombrado.
 */
export function checkFile(bytes: Uint8Array, declaredType: string, fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (!MIME_EXT[declaredType]?.includes(ext)) return false;
  const b = bytes;
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  switch (ext) {
    case "pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "jpg":
    case "jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "gif":
      return starts(0x47, 0x49, 0x46, 0x38);
    case "webp":
      return starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    case "zip":
    case "docx":
    case "xlsx":
      return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06);
    case "doc":
    case "xls":
      return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    default:
      return false;
  }
}

async function loadTarget(businessId: string, moduleId: string, recordId: string, definitionId: string) {
  const record = await prisma.customRecord.findFirst({ where: { id: recordId, businessId, moduleId }, select: { id: true } });
  if (!record) throw new Error("record_not_found");
  const definition = await prisma.customFieldDefinition.findFirst({
    where: { id: definitionId, businessId, moduleId, entityType: moduleEntityType(moduleId), type: "file" },
  });
  if (!definition) throw new Error("invalid_file_field");
  const current = await prisma.customFieldValue.findUnique({
    where: { definitionId_entityId: { definitionId, entityId: recordId } },
    select: { value: true },
  });
  return { definition, currentPath: current?.value ?? null };
}

export async function uploadRecordFile(
  businessId: string,
  moduleId: string,
  recordId: string,
  definitionId: string,
  file: { bytes: Uint8Array; declaredType: string; name: string }
) {
  if (file.bytes.byteLength === 0) throw new Error("file_empty");
  if (file.bytes.byteLength > MAX_FILE_BYTES) throw new Error("document_too_large");
  const name = sanitizeFileName(file.name);
  if (!checkFile(file.bytes, file.declaredType, name)) throw new Error("document_type_not_allowed");
  const { currentPath } = await loadTarget(businessId, moduleId, recordId, definitionId);
  await ensureBucket();

  const path = `${businessId}/${moduleId}/${recordId}/${definitionId}-${crypto.randomUUID()}/${name}`;
  const storage = getSupabaseAdmin().storage.from(RECORD_FILES_BUCKET);
  const { error } = await storage.upload(path, file.bytes, { contentType: file.declaredType, upsert: false });
  if (error) throw new Error(`No pudimos subir el archivo: ${error.message}`);

  const saved = await setCustomFieldValue(businessId, definitionId, recordId, path, { skipEntityCheck: true, allowStructured: true });
  if (!saved.ok) {
    await storage.remove([path]).catch(() => undefined);
    throw new Error("invalid_value");
  }
  // El archivo anterior se borra recién cuando el nuevo quedó guardado.
  if (currentPath && isPathOfBusiness(currentPath, businessId)) await storage.remove([currentPath]).catch(() => undefined);
  await prisma.customRecord.update({ where: { id: recordId }, data: { updatedAt: new Date() } });
  return { name, size: file.bytes.byteLength };
}

export async function removeRecordFile(businessId: string, moduleId: string, recordId: string, definitionId: string) {
  const { currentPath } = await loadTarget(businessId, moduleId, recordId, definitionId);
  await setCustomFieldValue(businessId, definitionId, recordId, null, { skipEntityCheck: true, allowStructured: true });
  if (currentPath && isPathOfBusiness(currentPath, businessId)) {
    await getSupabaseAdmin().storage.from(RECORD_FILES_BUCKET).remove([currentPath]).catch(() => undefined);
  }
}

/** URL de descarga (2 min, forzada como adjunto) del archivo de este campo, o null. */
export async function recordFileDownloadUrl(businessId: string, moduleId: string, recordId: string, definitionId: string) {
  const { currentPath } = await loadTarget(businessId, moduleId, recordId, definitionId);
  if (!currentPath || !isPathOfBusiness(currentPath, businessId)) return null;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(RECORD_FILES_BUCKET)
    .createSignedUrl(currentPath, DOWNLOAD_TTL_SECONDS, { download: fileNameFromPath(currentPath) ?? true });
  return error || !data ? null : data.signedUrl;
}

/** Borra de Storage los archivos cuyos valores se van a eliminar (best effort). */
export async function removeFilesForValues(businessId: string, where: { entityId?: string; definitionId?: string; moduleId?: string }) {
  const values = await prisma.customFieldValue.findMany({
    where: {
      ...(where.entityId ? { entityId: where.entityId } : {}),
      ...(where.definitionId ? { definitionId: where.definitionId } : {}),
      definition: { businessId, type: "file", ...(where.moduleId ? { moduleId: where.moduleId } : {}) },
    },
    select: { value: true },
  });
  const paths = values.flatMap((v) => (v.value && isPathOfBusiness(v.value, businessId) ? [v.value] : []));
  if (paths.length === 0) return;
  try {
    await getSupabaseAdmin().storage.from(RECORD_FILES_BUCKET).remove(paths);
  } catch {
    // Archivos huérfanos pero nunca accesibles (bucket privado, sin referencia).
  }
}
