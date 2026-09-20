import { prisma } from "@/lib/prisma";
import { getProvider } from "./providers";

export type EmailConfigStatus = "not_configured" | "provider_unavailable" | "sandbox" | "ready";

export interface EmailSettingsInput {
  provider: string;
  fromEmail?: string | null;
  fromName?: string | null;
}

export function deriveConfigStatus(s: { provider: string; fromEmail: string | null } | null): EmailConfigStatus {
  if (!s || !s.fromEmail) return "not_configured";
  const provider = getProvider(s.provider);
  if (!provider || !provider.isAvailable()) return "provider_unavailable";
  return s.provider === "sandbox" ? "sandbox" : "ready";
}

export async function getEmailSettings(businessId: string) {
  const settings = await prisma.emailSettings.findUnique({ where: { businessId } });
  return { settings, status: deriveConfigStatus(settings) };
}

export async function upsertEmailSettings(businessId: string, input: EmailSettingsInput) {
  const data = { provider: input.provider, fromEmail: input.fromEmail || null, fromName: input.fromName || null };
  const settings = await prisma.emailSettings.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });
  return { settings, status: deriveConfigStatus(settings) };
}
