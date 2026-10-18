import { prisma } from "@/lib/prisma";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listModuleFields } from "@/modules/custom-modules/service";
import { outgoingLinks } from "@/modules/records/links";
import { signedImageUrls } from "@/modules/records/images";

// Datos que necesita el formulario de un registro (alta o edición). Server-only.
export async function loadRecordFormData(businessId: string, moduleId: string, recordId?: string) {
  const [fields, members] = await Promise.all([listModuleFields(businessId, moduleId), listWorkspaceMembers(businessId)]);
  const formFields = fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options,
    required: f.required,
    targetEntity: f.targetEntity,
    multiple: f.multiple,
  }));
  const memberOptions = members.map((m) => ({ userId: m.userId, name: m.name || m.email }));
  if (!recordId) return { fields: formFields, members: memberOptions, values: {}, relations: {}, images: {} };

  const [values, links] = await Promise.all([
    prisma.customFieldValue.findMany({
      where: { entityId: recordId, definition: { businessId, moduleId } },
      select: { definitionId: true, value: true },
    }),
    outgoingLinks(businessId, recordId),
  ]);
  const imageDefs = new Set(fields.filter((f) => f.type === "image").map((f) => f.id));
  const urls = await signedImageUrls(businessId, values.flatMap((v) => (imageDefs.has(v.definitionId) && v.value ? [v.value] : [])));

  const valueMap: Record<string, string | null> = {};
  const images: Record<string, string | null> = {};
  for (const v of values) {
    if (imageDefs.has(v.definitionId)) images[v.definitionId] = v.value ? (urls.get(v.value) ?? null) : null;
    else valueMap[v.definitionId] = v.value;
  }
  const relations: Record<string, { id: string; label: string }[]> = {};
  for (const [defId, items] of links) relations[defId] = items.map((i) => ({ id: i.id, label: i.label }));

  return { fields: formFields, members: memberOptions, values: valueMap, relations, images };
}
