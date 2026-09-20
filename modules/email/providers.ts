export const EMAIL_PROVIDERS = ["sandbox", "resend"] as const;
export type EmailProviderKey = (typeof EMAIL_PROVIDERS)[number];

export interface OutgoingEmail {
  from: { email: string; name?: string | null };
  to: string;
  subject: string;
  html: string;
}
export type SendResult = { ok: true; simulated: boolean; messageId?: string } | { ok: false; error: string };

export interface EmailProvider {
  isAvailable(): boolean;
  send(message: OutgoingEmail): Promise<SendResult>;
}

// No entrega nada: permite probar el flujo completo sin credenciales.
// El resultado se marca `simulated` y así queda en el historial.
const sandbox: EmailProvider = {
  isAvailable: () => true,
  send: async () => ({ ok: true, simulated: true }),
};

// Resend vía REST (sin SDK). La API key es un secreto de plataforma.
const resend: EmailProvider = {
  isAvailable: () => !!process.env.RESEND_API_KEY,
  send: async (m) => {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, error: "provider_not_configured" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: m.from.name ? `${m.from.name.replace(/[<>"]/g, "")} <${m.from.email}>` : m.from.email,
          to: [m.to],
          subject: m.subject,
          html: m.html,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, error: data.message ?? `http_${res.status}` };
      return { ok: true, simulated: false, messageId: data.id };
    } catch {
      return { ok: false, error: "network_error" };
    }
  },
};

const PROVIDERS: Record<EmailProviderKey, EmailProvider> = { sandbox, resend };

export function getProvider(key: string): EmailProvider | null {
  return (PROVIDERS as Record<string, EmailProvider>)[key] ?? null;
}
