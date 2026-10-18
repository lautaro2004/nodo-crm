import { prisma } from "@/lib/prisma";
import { listItems, listProductModules } from "@/modules/opportunity-items/service";
import { signedImageUrls } from "@/modules/records/images";

// Datos de la tarjeta "Productos" del detalle de una oportunidad. Server-only.
export async function loadOpportunityItemsView(businessId: string, opportunityId: string) {
  const [items, modules] = await Promise.all([listItems(businessId, opportunityId), listProductModules(businessId)]);
  const recordIds = items.flatMap((i) => (i.recordId ? [i.recordId] : []));
  const priceFields = new Map<string, string>();
  const imageFields = new Map<string, string>();
  const records = recordIds.length
    ? await prisma.customRecord.findMany({
        where: { id: { in: recordIds }, businessId },
        select: { id: true, module: { select: { priceFieldId: true, imageFieldId: true } } },
      })
    : [];
  for (const r of records) {
    if (r.module.priceFieldId) priceFields.set(r.id, r.module.priceFieldId);
    if (r.module.imageFieldId) imageFields.set(r.id, r.module.imageFieldId);
  }
  const defIds = Array.from(new Set([...priceFields.values(), ...imageFields.values()]));
  const values = defIds.length
    ? await prisma.customFieldValue.findMany({
        where: { definitionId: { in: defIds }, entityId: { in: recordIds }, definition: { businessId } },
        select: { definitionId: true, entityId: true, value: true },
      })
    : [];
  const valueOf = (entityId: string, defId?: string) => (defId ? values.find((v) => v.entityId === entityId && v.definitionId === defId)?.value ?? null : null);
  const urls = await signedImageUrls(
    businessId,
    recordIds.flatMap((id) => {
      const v = valueOf(id, imageFields.get(id));
      return v ? [v] : [];
    })
  );

  return {
    modules,
    items: items.map((i) => {
      const price = i.recordId ? valueOf(i.recordId, priceFields.get(i.recordId)) : null;
      const image = i.recordId ? valueOf(i.recordId, imageFields.get(i.recordId)) : null;
      return {
        id: i.id,
        name: i.nameSnapshot,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        href: i.record ? `/dashboard/m/${i.record.module.key}/${i.record.id}` : null,
        imageUrl: image ? (urls.get(image) ?? null) : null,
        catalogPrice: price !== null && !Number.isNaN(Number(price)) ? Number(price) : null,
      };
    }),
  };
}
