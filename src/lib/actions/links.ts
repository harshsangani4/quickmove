"use server";

import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { getOpsContext, logActivity, type ActionResult } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintToken, hashToken } from "@/lib/portal/token";
import { serverEnv } from "@/lib/env";

const LINK_TTL_DAYS = 30;

/**
 * Ops mints a fresh customer magic link for a move (build doc §6). We verify the
 * ops user can access the move via RLS first, then write the (hashed) token with
 * the service role. Returns the full URL to copy/send. Old links stay valid until
 * explicitly revoked.
 */
export async function generateMagicLink(
  relocationId: string,
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return ctx;

  // Access check under RLS — only ops scoped to this move can mint its link.
  const { data: move } = await ctx.supabase
    .from("relocations")
    .select("id, customer_id")
    .eq("id", relocationId)
    .maybeSingle();
  if (!move) return { ok: false, error: "Move not found or outside your cities." };

  const raw = mintToken();
  const expiresAt = addDays(new Date(), LINK_TTL_DAYS).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("magic_links").insert({
    token: hashToken(raw),
    relocation_id: relocationId,
    customer_id: move.customer_id,
    expires_at: expiresAt,
    revoked: false,
  });
  if (error) return { ok: false, error: "Couldn't create the link. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "magic_link.created",
    entity: "magic_link",
    after: { expires_at: expiresAt },
  });

  const url = `${serverEnv.appBaseUrl}/portal/${raw}`;
  return { ok: true, data: { url, expiresAt } };
}

/** Revoke every active link for a move (e.g. if one leaked). */
export async function revokeMagicLinks(relocationId: string): Promise<ActionResult<{ revoked: number }>> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return ctx;

  const { data: move } = await ctx.supabase
    .from("relocations")
    .select("id")
    .eq("id", relocationId)
    .maybeSingle();
  if (!move) return { ok: false, error: "Move not found or outside your cities." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("magic_links")
    .update({ revoked: true })
    .eq("relocation_id", relocationId)
    .eq("revoked", false)
    .select("token");
  if (error) return { ok: false, error: "Couldn't revoke links." };

  await logActivity(ctx.supabase, {
    relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "magic_link.revoked",
    entity: "magic_link",
    after: { count: data?.length ?? 0 },
  });
  revalidatePath(`/moves/${relocationId}`);
  return { ok: true, data: { revoked: data?.length ?? 0 } };
}
