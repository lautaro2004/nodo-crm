import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var __supabaseAdmin: SupabaseClient | undefined;
}

// Mismo patrón que nexo/lib/supabase-admin.ts: cliente server-only con la
// service role key (bypassa RLS de Storage a propósito) — seguro porque
// toda operación de escritura pasa antes por modules/tasks/attachments.ts,
// que siempre resuelve businessId desde resolveWorkspaceContext(), nunca
// desde el cliente. Nunca importar esto desde código que corre en el
// browser.
function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!globalThis.__supabaseAdmin) {
    globalThis.__supabaseAdmin = createSupabaseAdmin();
  }
  return globalThis.__supabaseAdmin;
}
