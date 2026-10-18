import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { moduleEntityType } from "@/lib/custom-modules";
import { setCustomFieldValue } from "@/modules/custom-fields/service";

// Imágenes de los campos "image" de módulos personalizados.
//
// - Bucket PRIVADO "record-images" (mismo mecanismo que los adjuntos de
//   tareas: cliente service-role server-only + bucket creado perezosamente).
// - Ruta {businessId}/{moduleId}/{recordId}/{definitionId}-{uuid}.{ext}: la
//   carpeta ya separa negocios y módulos, además del scoping en Postgres.
// - En la base solo se guarda la ruta (CustomFieldValue.value), nunca el
//   binario ni una URL pública. Para mostrarla se firma una URL de 1 hora.

export const RECORD_IMAGES_BUCKET = "record-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const ALLOWED_IMAGE_TYPES = Object.keys(MIME_EXT);

let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`No pudimos verificar Supabase Storage: ${listError.message}`);
  if (!buckets.some((b) => b.name === RECORD_IMAGES_BUCKET)) {
    const { error } = await supabase.storage.createBucket(RECORD_IMAGES_BUCKET, {
      public: false,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: ALLOWED_IMAGE_TYPES,
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(`No pudimos crear el bucket de imágenes: ${error.message}`);
  }
  bucketEnsured = true;
}

/**
 * El tipo declarado por el navegador no alcanza: se verifica la firma real
 * del archivo (magic bytes) para no guardar, por ejemplo, un HTML/SVG
 * renombrado como .png.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Una ruta guardada solo es válida si está dentro de la carpeta del negocio. */
export function isPathOfBusiness(path: string, businessId: string) {
  return path.startsWith(`${businessId}/`) && !path.includes("..");
}

// Valida módulo → registro → campo (todo del mismo negocio) antes de tocar
// Storage. Devuelve la definición y el valor actual.
async function loadTarget(businessId: string, moduleId: string, recordId: string, definitionId: string) {
  const record = await prisma.customRecord.findFirst({ where: { id: recordId, businessId, moduleId }, select: { id: true } });
  if (!record) throw new Error("record_not_found");
  const definition = await prisma.customFieldDefinition.findFirst({
    where: { id: definitionId, businessId, moduleId, entityType: moduleEntityType(moduleId), type: "image" },
  });
  if (!definition) throw new Error("invalid_image_field");
  const current = await prisma.customFieldValue.findUnique({
    where: { definitionId_entityId: { definitionId, entityId: recordId } },
    select: { value: true },
  });
  return { definition, currentPath: current?.value ?? null };
}

export async function uploadRecordImage(
  businessId: string,
  moduleId: string,
  recordId: string,
  definitionId: string,
  file: { bytes: Uint8Array; declaredType: string }
) {
  if (file.bytes.byteLength === 0) throw new Error("file_empty");
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("file_too_large");
  const realType = sniffImageType(file.bytes);
  if (!realType || !ALLOWED_IMAGE_TYPES.includes(file.declaredType) || realType !== file.declaredType) {
    throw new Error("file_type_not_allowed");
  }
  const { currentPath } = await loadTarget(businessId, moduleId, recordId, definitionId);
  await ensureBucket();

  const path = `${businessId}/${moduleId}/${recordId}/${definitionId}-${crypto.randomUUID()}.${MIME_EXT[realType]}`;
  const storage = getSupabaseAdmin().storage.from(RECORD_IMAGES_BUCKET);
  const { error } = await storage.upload(path, file.bytes, { contentType: realType, upsert: false });
  if (error) throw new Error(`No pudimos subir la imagen: ${error.message}`);

  const saved = await setCustomFieldValue(businessId, definitionId, recordId, path, { skipEntityCheck: true, allowStructured: true });
  if (!saved.ok) {
    await storage.remove([path]).catch(() => undefined);
    throw new Error("invalid_value");
  }
  // La imagen anterior se borra recién cuando la nueva quedó guardada.
  if (currentPath && isPathOfBusiness(currentPath, businessId)) await storage.remove([currentPath]).catch(() => undefined);
  await prisma.customRecord.update({ where: { id: recordId }, data: { updatedAt: new Date() } });
  return { path, url: await signedImageUrl(businessId, path) };
}

export async function removeRecordImage(businessId: string, moduleId: string, recordId: string, definitionId: string) {
  const { currentPath } = await loadTarget(businessId, moduleId, recordId, definitionId);
  await setCustomFieldValue(businessId, definitionId, recordId, null, { skipEntityCheck: true, allowStructured: true });
  if (currentPath && isPathOfBusiness(currentPath, businessId)) {
    await getSupabaseAdmin().storage.from(RECORD_IMAGES_BUCKET).remove([currentPath]).catch(() => undefined);
  }
}

/** URL firmada (1 h) para una ruta de ESTE negocio; null si no corresponde. */
export async function signedImageUrl(businessId: string, path: string | null | undefined): Promise<string | null> {
  if (!path || !isPathOfBusiness(path, businessId)) return null;
  const { data, error } = await getSupabaseAdmin().storage.from(RECORD_IMAGES_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return error || !data ? null : data.signedUrl;
}

/** Varias URLs firmadas en una sola llamada (listas, selector de productos). */
export async function signedImageUrls(businessId: string, paths: string[]): Promise<Map<string, string>> {
  const valid = Array.from(new Set(paths.filter((p) => isPathOfBusiness(p, businessId))));
  const out = new Map<string, string>();
  if (valid.length === 0) return out;
  try {
    const { data } = await getSupabaseAdmin().storage.from(RECORD_IMAGES_BUCKET).createSignedUrls(valid, SIGNED_URL_TTL_SECONDS);
    for (const item of data ?? []) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  } catch {
    // Storage caído o sin configurar: la lista se muestra igual, sin miniaturas.
  }
  return out;
}

/** recordId → URL firmada de la imagen principal del módulo. */
export async function recordThumbnails(businessId: string, imageFieldId: string, recordIds: string[]) {
  const values = recordIds.length
    ? await prisma.customFieldValue.findMany({
        where: { definitionId: imageFieldId, entityId: { in: recordIds }, definition: { businessId } },
        select: { entityId: true, value: true },
      })
    : [];
  const urls = await signedImageUrls(businessId, values.flatMap((v) => (v.value ? [v.value] : [])));
  const out = new Map<string, string>();
  for (const v of values) if (v.value && urls.has(v.value)) out.set(v.entityId, urls.get(v.value)!);
  return out;
}

/** Borra de Storage las imágenes cuyos valores se van a eliminar (best effort). */
export async function removeImagesForValues(businessId: string, where: { entityId?: string; definitionId?: string; moduleId?: string }) {
  const values = await prisma.customFieldValue.findMany({
    where: {
      ...(where.entityId ? { entityId: where.entityId } : {}),
      ...(where.definitionId ? { definitionId: where.definitionId } : {}),
      definition: { businessId, type: "image", ...(where.moduleId ? { moduleId: where.moduleId } : {}) },
    },
    select: { value: true },
  });
  const paths = values.flatMap((v) => (v.value && isPathOfBusiness(v.value, businessId) ? [v.value] : []));
  if (paths.length === 0) return;
  try {
    await getSupabaseAdmin().storage.from(RECORD_IMAGES_BUCKET).remove(paths);
  } catch {
    // Si Storage no responde, quedan archivos huérfanos pero nunca accesibles
    // (bucket privado, sin referencia en la base).
  }
}
