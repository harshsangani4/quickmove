/**
 * Service-role Supabase client — BYPASSES Row-Level Security.
 *
 * SERVER ONLY. Never import this into a client component or expose the key.
 * Used for:
 *  - the seed script,
 *  - portal server routes (after a magic link is verified, queries are filtered
 *    in code to the single relocation_id the token grants — see build doc §4),
 *  - privileged multi-table writes (playbook generation, escalations, comms queue).
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";

export function createAdminClient() {
  const key = serverEnv.serviceRoleKey;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — privileged server operations are unavailable.",
    );
  }
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
