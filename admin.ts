import { createClient } from "@supabase/supabase-js";

/**
 * Client « service » : contourne les règles RLS.
 * À n’utiliser que côté serveur, pour les opérations d’administration
 * (création de comptes, données de démonstration, expédition des notifications).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante dans la configuration.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
