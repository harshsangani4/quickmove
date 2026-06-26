"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays, formatISO, isBefore, parseISO, startOfDay } from "date-fns";
import { getOpsContext, logActivity, recomputeRelocation, type ActionResult } from "./_helpers";

function revalidateMove(relocationId: string) {
  revalidatePath(`/moves/${relocationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}

const isoDate = (d: Date) => formatISO(d, { representation: "date" });

export interface ReflowChange {
  taskId: string;
  title: string;
  oldDue: string | null;
  newDue: string;
}

/**
 * Preview a timeline reflow (build doc §3, §5.3): recompute due dates of all
 * non-done tasks for a new move date, WITHOUT applying — the caller shows a diff
 * and requires confirmation before we move dates the customer was promised.
 */
export async function previewReflow(
  relocationId: string,
  newMoveDate: string,
): Promise<ActionResult<{ changes: ReflowChange[]; oldMoveDate: string }>> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (isBefore(startOfDay(parseISO(newMoveDate)), startOfDay(new Date()))) {
    return { ok: false, error: "Move date can't be in the past." };
  }

  const { data: reloc } = await ctx.supabase
    .from("relocations")
    .select("move_date, destination_city_id")
    .eq("id", relocationId)
    .maybeSingle();
  if (!reloc) return { ok: false, error: "Move not found." };

  const { data: templates } = await ctx.supabase
    .from("task_templates")
    .select("key, lead_time_days")
    .eq("city_id", reloc.destination_city_id);
  const leadByKey = new Map((templates ?? []).map((t: any) => [t.key, t.lead_time_days]));

  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("id, title, template_key, due_date, status")
    .eq("relocation_id", relocationId)
    .neq("status", "done");

  const newMove = parseISO(newMoveDate);
  const changes: ReflowChange[] = [];
  for (const t of tasks ?? []) {
    const lead = leadByKey.get(t.template_key);
    if (lead === undefined) continue;
    const newDue = isoDate(addDays(newMove, lead));
    if (newDue !== t.due_date) {
      changes.push({ taskId: t.id, title: t.title, oldDue: t.due_date, newDue });
    }
  }

  return { ok: true, data: { changes, oldMoveDate: reloc.move_date } };
}

/** Apply a reflow: update the move date + all non-done task due dates, log, recompute. */
export async function applyReflow(
  relocationId: string,
  newMoveDate: string,
): Promise<ActionResult> {
  const preview = await previewReflow(relocationId, newMoveDate);
  if (!preview.ok) return preview;
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  for (const c of preview.data!.changes) {
    await ctx.supabase.from("tasks").update({ due_date: c.newDue }).eq("id", c.taskId);
  }
  const { error } = await ctx.supabase
    .from("relocations")
    .update({ move_date: newMoveDate })
    .eq("id", relocationId);
  if (error) return { ok: false, error: "Couldn't reflow. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "relocation.reflowed",
    entity: "relocation",
    before: { move_date: preview.data!.oldMoveDate },
    after: { move_date: newMoveDate, tasks_shifted: preview.data!.changes.length },
  });

  await recomputeRelocation(ctx.supabase, relocationId);
  revalidateMove(relocationId);
  return { ok: true };
}

const STAGE_ORDER = [
  "intake", "housing", "logistics", "utilities", "paperwork", "post_move", "done",
] as const;
const CATEGORY_TO_STAGE: Record<string, string> = {
  apartment: "housing",
  movers: "logistics",
  utility: "utilities",
  paperwork: "paperwork",
  support: "post_move",
};
const STAGE_LABEL: Record<string, string> = {
  intake: "Intake", housing: "Housing", logistics: "Logistics", utilities: "Utilities",
  paperwork: "Paperwork", post_move: "Post-move", done: "Done",
};

const stageSchema = z.object({
  relocationId: z.string().uuid(),
  stage: z.enum(STAGE_ORDER),
});

/**
 * Move a card to a new stage on the pipeline board (build doc §5.2).
 * Forward moves are blocked if an earlier stage still has incomplete tasks —
 * you can't skip ahead of unfinished required work. Backward moves are allowed.
 */
export async function setStage(input: {
  relocationId: string;
  stage: (typeof STAGE_ORDER)[number];
}): Promise<ActionResult> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { relocationId, stage } = parsed.data;
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: reloc } = await ctx.supabase
    .from("relocations")
    .select("stage, status")
    .eq("id", relocationId)
    .maybeSingle();
  if (!reloc) return { ok: false, error: "Move not found." };
  if (reloc.status === "cancelled" || reloc.status === "completed") {
    return { ok: false, error: "This move is closed." };
  }
  if (reloc.stage === stage) return { ok: true };

  const targetIdx = STAGE_ORDER.indexOf(stage);
  const currentIdx = STAGE_ORDER.indexOf(reloc.stage as (typeof STAGE_ORDER)[number]);

  // Forward move: every task in an earlier stage must be done.
  if (targetIdx > currentIdx) {
    const { data: tasks } = await ctx.supabase
      .from("tasks")
      .select("title, category, status")
      .eq("relocation_id", relocationId);
    const blocker = (tasks ?? []).find((t: any) => {
      const sIdx = STAGE_ORDER.indexOf(
        (CATEGORY_TO_STAGE[t.category] ?? "intake") as (typeof STAGE_ORDER)[number],
      );
      return sIdx < targetIdx && t.status !== "done";
    });
    if (blocker) {
      const blockerStage = STAGE_LABEL[CATEGORY_TO_STAGE[(blocker as any).category]] ?? "an earlier stage";
      return {
        ok: false,
        error: `Can't skip ahead — "${(blocker as any).title}" in ${blockerStage} isn't done yet.`,
      };
    }
  }

  const { error } = await ctx.supabase
    .from("relocations")
    .update({ stage })
    .eq("id", relocationId);
  if (error) return { ok: false, error: "Couldn't update stage. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "relocation.stage_changed",
    entity: "relocation",
    before: { stage: reloc.stage },
    after: { stage },
  });
  revalidateMove(relocationId);
  return { ok: true };
}

const holdSchema = z.object({ relocationId: z.string().uuid(), hold: z.boolean() });

export async function setHold(input: { relocationId: string; hold: boolean }): Promise<ActionResult> {
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: reloc } = await ctx.supabase
    .from("relocations")
    .select("status")
    .eq("id", parsed.data.relocationId)
    .maybeSingle();
  if (!reloc) return { ok: false, error: "Move not found." };
  if (reloc.status === "cancelled" || reloc.status === "completed") {
    return { ok: false, error: "This move is closed and can't change hold state." };
  }

  const next = parsed.data.hold ? "on_hold" : "active";
  const { error } = await ctx.supabase
    .from("relocations")
    .update({ status: next })
    .eq("id", parsed.data.relocationId);
  if (error) return { ok: false, error: "Couldn't update. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId: parsed.data.relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: parsed.data.hold ? "relocation.on_hold" : "relocation.resumed",
    entity: "relocation",
    before: { status: reloc.status },
    after: { status: next },
  });
  revalidateMove(parsed.data.relocationId);
  return { ok: true };
}

/** Cancel a move. Requires typed confirmation on the client; read-only afterward. */
export async function cancelMove(relocationId: string): Promise<ActionResult> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: reloc } = await ctx.supabase
    .from("relocations")
    .select("status")
    .eq("id", relocationId)
    .maybeSingle();
  if (!reloc) return { ok: false, error: "Move not found." };
  if (reloc.status === "cancelled") return { ok: false, error: "Already cancelled." };

  const { error } = await ctx.supabase
    .from("relocations")
    .update({ status: "cancelled", archived_at: new Date().toISOString() })
    .eq("id", relocationId);
  if (error) return { ok: false, error: "Couldn't cancel. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "relocation.cancelled",
    entity: "relocation",
    before: { status: reloc.status },
    after: { status: "cancelled" },
  });
  revalidateMove(relocationId);
  return { ok: true };
}

/** Restore a cancelled move — admin/lead only (build doc §5.3). */
export async function restoreMove(relocationId: string): Promise<ActionResult> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (ctx.user.role !== "admin" && ctx.user.role !== "lead") {
    return { ok: false, error: "Only a lead or admin can restore a cancelled move." };
  }

  const { error } = await ctx.supabase
    .from("relocations")
    .update({ status: "active", archived_at: null })
    .eq("id", relocationId);
  if (error) return { ok: false, error: "Couldn't restore. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "relocation.restored",
    entity: "relocation",
    after: { status: "active" },
  });
  await recomputeRelocation(ctx.supabase, relocationId);
  revalidateMove(relocationId);
  return { ok: true };
}

const messageSchema = z.object({
  relocationId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

/** Ops sends a message to the customer thread (mirrors to the portal). */
export async function sendOpsMessage(input: {
  relocationId: string;
  body: string;
}): Promise<ActionResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Message can't be empty." };
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase.from("messages").insert({
    relocation_id: parsed.data.relocationId,
    sender: "ops",
    channel: "app",
    body: parsed.data.body,
  });
  if (error) return { ok: false, error: "Couldn't send. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId: parsed.data.relocationId,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "message.sent",
    entity: "message",
    after: { preview: parsed.data.body.slice(0, 80) },
  });
  revalidateMove(parsed.data.relocationId);
  return { ok: true };
}
