import { prisma } from "@/lib/prisma";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { listTagsForEntity } from "@/modules/tags/service";

// Fase 5 — Conversión de Leads (Lead -> Contact -> Opportunity opcional).
// Ver docs/architecture/crm-fase5-lead-conversion.md para el razonamiento
// completo de cada decisión de abajo.

export class ConversionError extends Error {}

// Lanzado específicamente cuando el Lead YA estaba convertido — distinto
// de las demás ConversionError porque el caller (la ruta de API) necesita
// el Lead ya convertido para devolverlo en la respuesta (idempotencia
// "amigable": ver sección 6/17 del pedido — nunca un error ciego, siempre
// "Lead convertido, acá están el Contact/Opportunity").
export class AlreadyConvertedError extends Error {
  constructor(public lead: NonNullable<Awaited<ReturnType<typeof getConvertedLead>>>) {
    super("lead_already_converted");
  }
}

async function getConvertedLead(businessId: string, id: string) {
  return prisma.lead.findFirst({
    where: { id, businessId },
    include: {
      convertedContact: { select: { id: true, name: true } },
      convertedOpportunity: { select: { id: true, title: true } },
    },
  });
}

export interface ConvertLeadInput {
  contact: { mode: "new" } | { mode: "existing"; contactId: string };
  createOpportunity: boolean;
  opportunity?: {
    title: string;
    pipelineId: string;
    stageId: string;
    ownerId?: string | null;
    amount?: number | null;
  };
}

// Idempotente por construcción: el UPDATE final que marca el Lead como
// convertido lleva `WHERE convertedAt IS NULL` — es la base la que decide
// si "gana" esta conversión o no, no un check-then-write en JS (que tiene
// una ventana de carrera real bajo doble click / doble request). Si el
// UPDATE afecta 0 filas, alguien más ya convirtió este Lead entre nuestro
// findFirst inicial y este punto — se aborta la transacción entera
// (Contact/Opportunity que se hubieran creado en este intento se
// revierten) y se informa como AlreadyConvertedError.
//
// Atómico: todo el flujo (validar, crear/reusar Contact, crear
// Opportunity, marcar el Lead, tags, Activity) corre en una única
// prisma.$transaction — si cualquier paso falla, no queda nada a medio
// crear (pedido explícito, sección 22).
export async function convertLead(businessId: string, leadId: string, input: ConvertLeadInput, actorUserId: string | null) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: leadId, businessId } });
    if (!lead) throw new ConversionError("lead_not_found");
    if (lead.convertedAt) throw new AlreadyConvertedError((await getConvertedLead(businessId, leadId))!);

    // ── Contacto: crear nuevo o reusar uno existente del MISMO Business ──
    let contactId: string;
    let contactCreated = false;
    if (input.contact.mode === "existing") {
      const contact = await tx.contact.findFirst({ where: { id: input.contact.contactId, businessId } });
      if (!contact) throw new ConversionError("contact_not_found");
      contactId = contact.id;
    } else {
      const created = await tx.contact.create({
        data: {
          businessId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          // Company del Lead se REUSA, nunca se crea una nueva acá (sección 9).
          companyId: lead.companyId,
          ownerId: actorUserId,
        },
      });
      contactId = created.id;
      contactCreated = true;
    }

    // ── Oportunidad opcional ──
    let opportunityId: string | null = null;
    if (input.createOpportunity) {
      const opp = input.opportunity;
      if (!opp) throw new ConversionError("opportunity_data_missing");

      const pipeline = await tx.pipeline.findFirst({ where: { id: opp.pipelineId, businessId } });
      if (!pipeline) throw new ConversionError("pipeline_not_found");

      const stage = await tx.pipelineStage.findFirst({ where: { id: opp.stageId, pipelineId: pipeline.id } });
      if (!stage) throw new ConversionError("stage_not_found");

      if (opp.ownerId) await assertUserBelongsToBusiness(businessId, opp.ownerId, tx);

      const created = await tx.opportunity.create({
        data: {
          businessId,
          title: opp.title,
          companyId: lead.companyId,
          contactId,
          pipelineId: pipeline.id,
          stageId: stage.id,
          ownerId: opp.ownerId ?? null,
          amount: opp.amount ?? null,
        },
      });
      opportunityId = created.id;
    }

    // ── Marca el Lead como convertido — guarda de idempotencia real ──
    const updateResult = await tx.lead.updateMany({
      where: { id: leadId, businessId, convertedAt: null },
      data: {
        status: "converted",
        convertedAt: new Date(),
        convertedContactId: contactId,
        convertedOpportunityId: opportunityId,
      },
    });
    if (updateResult.count === 0) {
      throw new AlreadyConvertedError((await getConvertedLead(businessId, leadId))!);
    }

    // ── Tags: Lead -> Contact SOLO si el Contact es nuevo (sección 14) —
    // copiar tags a un Contact que YA EXISTÍA de antes sería alterar una
    // ficha ajena a esta conversión con etiquetas que quizás no aplican
    // (ese Contact puede tener su propio historial y contexto previo). No
    // se copian tags a la Opportunity: es un tipo de entidad distinto, sin
    // garantía de que la misma taxonomía de etiquetas tenga sentido ahí.
    if (contactCreated) {
      const leadTags = await listTagsForEntity(businessId, "lead", leadId);
      if (leadTags.length > 0) {
        await tx.entityTag.createMany({
          data: leadTags.map((tag) => ({ businessId, tagId: tag.id, entityType: "contact" as const, entityId: contactId })),
          skipDuplicates: true,
        });
      }
    }

    // ── Activity: historial transversal, sin sistema paralelo (sección 13) ──
    await tx.activity.create({
      data: { businessId, relatedType: "lead", relatedId: leadId, type: "converted", body: "Lead convertido", ownerId: actorUserId },
    });
    if (opportunityId) {
      await tx.activity.create({
        data: {
          businessId,
          relatedType: "opportunity",
          relatedId: opportunityId,
          type: "note",
          body: `Oportunidad creada desde el Lead "${lead.name}"`,
          ownerId: actorUserId,
        },
      });
    }

    return tx.lead.findFirst({
      where: { id: leadId },
      include: {
        convertedContact: { select: { id: true, name: true } },
        convertedOpportunity: { select: { id: true, title: true } },
      },
    });
  });
}

export interface PossibleDuplicateContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: { id: string; name: string } | null;
}

// Detección de posibles contactos existentes ANTES de convertir (sección
// 5) — usa los datos que el Lead YA tiene (teléfono/email), nunca el
// nombre solo como criterio de identidad (un nombre repetido no es
// suficiente señal). Server-side y scopeada por businessId: el frontend
// nunca envía el criterio de búsqueda, solo el leadId — evita que alguien
// use este endpoint como buscador arbitrario de contactos.
export async function findPossibleDuplicateContacts(businessId: string, leadId: string): Promise<PossibleDuplicateContact[]> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { email: true, phone: true } });
  if (!lead) return [];

  const email = lead.email?.trim() || null;
  const phone = lead.phone?.trim() || null;
  if (!email && !phone) return [];

  return prisma.contact.findMany({
    where: {
      businessId,
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    },
    select: { id: true, name: true, email: true, phone: true, company: { select: { id: true, name: true } } },
    take: 5,
  });
}
