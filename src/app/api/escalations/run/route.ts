/**
 * Auto-escalation job (build doc §5.3). Flags tasks that are blocked > 24h, or
 * overdue and on the critical path, creates an `escalation` (deduped per task),
 * and queues a notification to the owner + lead via comms_queue.
 *
 * Run via GET (e.g. a Vercel Cron). Idempotent.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CRITICAL_CATEGORIES = ["apartment", "movers", "utility"];

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.nextUrl.searchParams.get("secret") === secret || req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Candidate tasks: blocked, or overdue on the critical path, on active moves.
  const { data: tasks } = await db
    .from("tasks")
    .select("id, relocation_id, title, status, due_date, category, blocked_reason, updated_at, relocation:relocations!inner(status)")
    .or(`status.eq.blocked,and(status.neq.done,due_date.lt.${today})`);

  let created = 0;
  for (const t of (tasks ?? []) as any[]) {
    if (t.relocation?.status !== "active") continue;

    const blockedLongEnough = t.status === "blocked" && t.updated_at <= dayAgo;
    const overdueCritical = t.status !== "done" && t.due_date < today && CRITICAL_CATEGORIES.includes(t.category);
    if (!blockedLongEnough && !overdueCritical) continue;

    // Dedupe: skip if an open escalation already exists for this task.
    const { data: existing } = await db
      .from("escalations")
      .select("id")
      .eq("task_id", t.id)
      .eq("status", "open")
      .maybeSingle();
    if (existing) continue;

    const reason = t.status === "blocked"
      ? `Blocked >24h: ${t.title}${t.blocked_reason ? ` (${t.blocked_reason})` : ""}`
      : `Overdue on critical path: ${t.title}`;

    await db.from("escalations").insert({ relocation_id: t.relocation_id, task_id: t.id, reason, level: 2, status: "open" });

    // Notify owner + lead (simulated via comms queue).
    await db.from("comms_queue").insert({
      relocation_id: t.relocation_id,
      channel: "email",
      template_key: "escalation_alert",
      payload: { text: reason },
      status: "queued",
    });
    created++;
  }

  return NextResponse.json({ ok: true, checked: tasks?.length ?? 0, created });
}
