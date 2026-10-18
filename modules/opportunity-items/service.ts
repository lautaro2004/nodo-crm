import { prisma } from "@/lib/prisma";

// Productos (registros de un módulo personalizado) agregados a una
// oportunidad. Reglas de negocio (decididas con el negocio, opción B):
// - nombre y precio se COPIAN al agregar (snapshot histórico): cambiar el
//   catálogo después no altera oportunidades existentes;
// - el valor de la oportunidad NO se pisa solo: se muestra el total de los
//   productos y el usuario lo aplica con "Usar total de productos";
// - en oportunidades cerradas no se agregan ni se modifican productos.

async function loadOpenOpportunity(businessId: string, opportunityId: string) {
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, businessId }, select: { id: true, status: true } });
  if (!opp) throw new Error("opportunity_not_found");
  if (opp.status !== "open") throw new Error("opportunity_closed");
  return opp;
}

export async function listItems(businessId: string, opportunityId: string) {
  return prisma.opportunityItem.findMany({
    where: { businessId, opportunityId },
    orderBy: { createdAt: "asc" },
    include: { record: { select: { id: true, archivedAt: true, module: { select: { key: true, imageFieldId: true } } } } },
  });
}

export function itemsTotal(items: { unitPrice: number; quantity: number }[]) {
  return Math.round(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) * 100) / 100;
}

// Precio actual del catálogo (campo "precio" del módulo), o null si el
// módulo no tiene uno configurado o el registro no tiene precio cargado.
async function currentCatalogPrice(businessId: string, recordId: string) {
  const record = await prisma.customRecord.findFirst({
    where: { id: recordId, businessId, archivedAt: null, module: { archivedAt: null } },
    select: { id: true, title: true, module: { select: { priceFieldId: true } } },
  });
  if (!record) throw new Error("record_not_found");
  let price: number | null = null;
  if (record.module.priceFieldId) {
    const v = await prisma.customFieldValue.findUnique({
      where: { definitionId_entityId: { definitionId: record.module.priceFieldId, entityId: recordId } },
      select: { value: true },
    });
    price = v?.value !== undefined && v?.value !== null && !Number.isNaN(Number(v.value)) ? Number(v.value) : null;
  }
  return { title: record.title, price };
}

export async function addItem(businessId: string, opportunityId: string, data: { recordId: string; quantity?: number; unitPrice?: number }) {
  await loadOpenOpportunity(businessId, opportunityId);
  const { title, price } = await currentCatalogPrice(businessId, data.recordId);
  return prisma.opportunityItem.create({
    data: {
      businessId,
      opportunityId,
      recordId: data.recordId,
      nameSnapshot: title,
      // Precio aplicado: el que el usuario fija, o el del catálogo HOY.
      unitPrice: data.unitPrice ?? price ?? 0,
      quantity: data.quantity ?? 1,
    },
  });
}

export async function updateItem(businessId: string, opportunityId: string, itemId: string, data: { quantity?: number; unitPrice?: number }) {
  await loadOpenOpportunity(businessId, opportunityId);
  const result = await prisma.opportunityItem.updateMany({
    where: { id: itemId, businessId, opportunityId },
    data: { ...(data.quantity !== undefined ? { quantity: data.quantity } : {}), ...(data.unitPrice !== undefined ? { unitPrice: data.unitPrice } : {}) },
  });
  return result.count > 0;
}

export async function removeItem(businessId: string, opportunityId: string, itemId: string) {
  await loadOpenOpportunity(businessId, opportunityId);
  const result = await prisma.opportunityItem.deleteMany({ where: { id: itemId, businessId, opportunityId } });
  return result.count > 0;
}

/** "Usar total de productos": copia la suma al valor de la oportunidad (solo abiertas). */
export async function applyItemsTotal(businessId: string, opportunityId: string) {
  await loadOpenOpportunity(businessId, opportunityId);
  const items = await prisma.opportunityItem.findMany({ where: { businessId, opportunityId }, select: { unitPrice: true, quantity: true } });
  if (items.length === 0) throw new Error("no_items");
  const amount = itemsTotal(items);
  await prisma.opportunity.update({ where: { id: opportunityId }, data: { amount } });
  return amount;
}

/** Vista inversa: oportunidades donde aparece un producto. */
export async function listOpportunitiesForRecord(businessId: string, recordId: string) {
  const items = await prisma.opportunityItem.findMany({
    where: { businessId, recordId },
    include: { opportunity: { select: { id: true, title: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return items.map((i) => ({ id: i.opportunity.id, title: i.opportunity.title, status: i.opportunity.status, unitPrice: i.unitPrice, quantity: i.quantity }));
}

/** Módulos que pueden aportar productos (tienen campo precio). */
export async function listProductModules(businessId: string) {
  return prisma.customModule.findMany({
    where: { businessId, archivedAt: null, priceFieldId: { not: null } },
    select: { id: true, labelPlural: true, labelSingular: true },
    orderBy: { order: "asc" },
  });
}
