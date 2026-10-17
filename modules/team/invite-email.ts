import { getProvider } from "@/modules/email/providers";
import { PRODUCT_LABELS, ROLE_LABELS, type Product, type Role } from "@/lib/permissions";

const DEFAULT_FROM = "Nodo by Kodexa <contacto@kodexa.ar>";

function parseFrom(raw: string) {
  const m = /^(.*)<(.+)>$/.exec(raw.trim());
  return m ? { name: m[1].trim() || null, email: m[2].trim() } : { name: null, email: raw.trim() };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Email de invitación — sale con el remitente de la PLATAFORMA (Resend,
// EMAIL_FROM), no con el del negocio: no depende de que el negocio haya
// configurado su email. Sin RESEND_API_KEY no se envía y la UI ofrece
// copiar el link.
export async function sendInvitationEmail(input: {
  to: string;
  link: string;
  businessName: string;
  inviterName: string | null;
  role: Role;
  products: Product[];
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getProvider("resend");
  if (!resend?.isAvailable()) return { sent: false, error: "provider_not_configured" };

  const products = input.products.map((p) => PRODUCT_LABELS[p]).join(" y ");
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#202124">
  <p style="font-size:15px">Hola,</p>
  <p style="font-size:15px">${esc(input.inviterName ?? "El equipo")} te invitó a sumarte a <strong>${esc(input.businessName)}</strong> como <strong>${esc(ROLE_LABELS[input.role])}</strong>, con acceso a ${esc(products)}.</p>
  <p style="margin:28px 0"><a href="${esc(input.link)}" style="background:#fb6e1a;color:#202124;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px;display:inline-block">Aceptar invitación</a></p>
  <p style="font-size:13px;color:#55585d">El link vence en 7 días. Si no esperabas esta invitación, podés ignorar este email.</p>
  <p style="font-size:12px;color:#75746f;word-break:break-all">${esc(input.link)}</p>
</div>`;
  const result = await resend.send({
    from: parseFrom(process.env.EMAIL_FROM || DEFAULT_FROM),
    to: input.to,
    subject: `Te invitaron a ${input.businessName} en Nodo`,
    html,
  });
  return result.ok ? { sent: true } : { sent: false, error: result.error };
}

export function appBaseUrl(request: Request) {
  return (process.env.BETTER_AUTH_URL || new URL(request.url).origin).replace(/\/$/, "");
}
