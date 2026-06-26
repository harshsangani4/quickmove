/**
 * Magic-link token handling (build doc §6, §9).
 *
 * We store only the SHA-256 hash of a token. The raw token lives only in the
 * customer's link. Verification hashes the incoming token and looks it up,
 * checking expiry + revocation. Verification is idempotent — it does not burn a
 * still-valid token (we record used_at for audit but keep the link usable).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function mintToken(): string {
  return randomBytes(24).toString("base64url");
}

export type VerifyResult =
  | { ok: true; relocationId: string; customerId: string | null }
  | { ok: false; reason: "not_found" | "expired" | "revoked" };

export async function verifyToken(raw: string): Promise<VerifyResult> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("magic_links")
    .select("token, relocation_id, customer_id, expires_at, revoked")
    .eq("token", hashToken(raw))
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "not_found" };
  if (data.revoked) return { ok: false, reason: "revoked" };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  // Record first use for audit; keep the link usable (idempotent).
  await db
    .from("magic_links")
    .update({ used_at: new Date().toISOString() })
    .eq("token", hashToken(raw))
    .is("used_at", null);

  return { ok: true, relocationId: data.relocation_id, customerId: data.customer_id };
}
