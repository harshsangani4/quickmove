/**
 * Browser Supabase client (anon key, RLS-enforced).
 * Used by ops client components. Never receives a service-role key.
 */
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
