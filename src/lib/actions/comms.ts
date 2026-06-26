"use server";

import { revalidatePath } from "next/cache";
import { getOpsContext, type ActionResult } from "./_helpers";

/** Requeue a failed/dead notification for another delivery attempt (build doc §8). */
export async function retryCommsItem(id: string): Promise<ActionResult> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return ctx;
  if (ctx.user.role !== "admin" && ctx.user.role !== "lead") {
    return { ok: false, error: "Only a lead or admin can retry deliveries." };
  }
  const { data: item } = await ctx.supabase.from("comms_queue").select("payload").eq("id", id).maybeSingle();
  if (!item) return { ok: false, error: "Item not found." };

  // Clear the simulated-failure flag so a manual retry can succeed, and requeue.
  const payload = { ...(item.payload as any) };
  delete payload.simulateFail;

  const { error } = await ctx.supabase
    .from("comms_queue")
    .update({ status: "queued", attempts: 0, last_error: null, next_attempt_at: new Date().toISOString(), payload })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't requeue." };
  revalidatePath("/delivery");
  return { ok: true };
}
