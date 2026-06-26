/**
 * Comms queue worker (build doc §8). Processes queued/failed notifications with
 * exponential backoff; after N attempts an item is marked `dead` and surfaced in
 * the ops "Delivery issues" view. Sending is SIMULATED (no real provider) — a
 * payload flag `simulateFail: true` forces the failure path for the demo.
 *
 * Run via GET (e.g. a Vercel Cron). Idempotent and safe to re-run.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;

/** In prod, set CRON_SECRET. Accepts Vercel Cron's `Authorization: Bearer <secret>`
 *  header, or `?secret=` / `x-cron-secret`. Local (no secret set): open. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret ||
    req.nextUrl.searchParams.get("secret") === secret
  );
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: items, error } = await db
    .from("comms_queue")
    .select("*")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0, failed = 0, dead = 0;

  for (const item of items ?? []) {
    const attempts = (item.attempts ?? 0) + 1;
    const willFail = Boolean((item.payload as any)?.simulateFail);

    if (!willFail) {
      await db.from("comms_queue").update({ status: "sent", attempts, last_error: null }).eq("id", item.id);
      // Mirror the notification into the message thread.
      await db.from("messages").insert({
        relocation_id: item.relocation_id,
        sender: "system",
        channel: item.channel,
        body: `[${item.channel}] ${(item.payload as any)?.text ?? item.template_key}`,
      });
      sent++;
    } else {
      const backoffMin = Math.pow(2, attempts); // 2,4,8,16,32 min
      const next = new Date(Date.now() + backoffMin * 60_000).toISOString();
      if (attempts >= MAX_ATTEMPTS) {
        await db.from("comms_queue").update({ status: "dead", attempts, last_error: "Max retries reached (simulated)" }).eq("id", item.id);
        dead++;
      } else {
        await db.from("comms_queue").update({ status: "failed", attempts, next_attempt_at: next, last_error: "Delivery failed (simulated)" }).eq("id", item.id);
        failed++;
      }
    }
  }

  return NextResponse.json({ ok: true, processed: items?.length ?? 0, sent, failed, dead });
}
