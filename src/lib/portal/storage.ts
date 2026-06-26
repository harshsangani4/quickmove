import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Short-lived signed URL for a private document (build doc §9). Access is via the
 *  portal which is already token-gated to this relocation. */
export async function getSignedDocUrl(path: string, ttlSeconds = 120): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db.storage.from("documents").createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}
