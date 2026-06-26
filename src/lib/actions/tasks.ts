"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOpsContext, logActivity, recomputeRelocation, type ActionResult } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { lockedByDependencies } from "@/lib/playbook/engine";
import type { TaskStatus } from "@/lib/types";

const ALLOWED_PROOF_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_PROOF_BYTES = 8 * 1024 * 1024; // 8 MB

function revalidateMove(relocationId: string) {
  revalidatePath(`/moves/${relocationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}

/** Fetch the task (RLS-scoped) and confirm the ops user can act on it. */
async function loadTaskForActor(taskId: string) {
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false as const, error: "Task not found or outside your cities." };
  return { ok: true as const, ctx, task };
}

async function isLocked(supabase: any, relocationId: string, templateKey: string) {
  const { data: siblings } = await supabase
    .from("tasks")
    .select("template_key, status, depends_on")
    .eq("relocation_id", relocationId);
  const locked = lockedByDependencies(
    (siblings ?? []).map((t: any) => ({
      template_key: t.template_key,
      status: t.status,
      depends_on: t.depends_on ?? [],
    })),
  );
  return locked[templateKey]?.length ? locked[templateKey] : null;
}

/**
 * Proof-gated completion (build doc §5.3). A task that `requires_proof` cannot be
 * closed without valid proof — this prevents fake-complete. Audit-logged.
 * Accepts FormData: taskId, proofValue (text), file (for photo/doc proof types).
 */
export async function completeTask(formData: FormData): Promise<ActionResult> {
  const taskId = String(formData.get("taskId") ?? "");
  const proofValueRaw = String(formData.get("proofValue") ?? "").trim();
  const file = formData.get("file");

  const loaded = await loadTaskForActor(taskId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx, task } = loaded;

  // Cannot complete a task whose prerequisites aren't done yet.
  const lockedBy = await isLocked(ctx.supabase, task.relocation_id, task.template_key);
  if (lockedBy) {
    return { ok: false, error: "Finish the prerequisite task(s) first." };
  }

  let proofValue: string | null = null;
  let proofUrl: string | null = null;

  if (task.requires_proof) {
    const needsFile = task.proof_type === "photo" || task.proof_type === "doc";
    if (needsFile) {
      if (!(file instanceof File) || file.size === 0) {
        return { ok: false, error: "Please attach the required file as proof." };
      }
      if (!ALLOWED_PROOF_FILE_TYPES.includes(file.type)) {
        return { ok: false, error: "Allowed file types: PDF, JPG, PNG." };
      }
      if (file.size > MAX_PROOF_BYTES) {
        return { ok: false, error: "File is too large (max 8 MB)." };
      }
      // Upload to the private documents bucket via the service role.
      const admin = createAdminClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `proofs/${task.relocation_id}/${taskId}-${Date.now()}-${safeName}`;
      const { error: upErr } = await admin.storage
        .from("documents")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) return { ok: false, error: "Upload failed. Please try again." };
      proofUrl = path;
      proofValue = file.name;
    } else {
      if (!proofValueRaw) {
        return { ok: false, error: "Proof is required to complete this task." };
      }
      proofValue = proofValueRaw;
    }
  }

  const { error } = await ctx.supabase
    .from("tasks")
    .update({
      status: "done",
      proof_value: proofValue,
      proof_url: proofUrl,
      blocked_reason: null,
      completed_at: new Date().toISOString(),
      completed_by: ctx.user.id,
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: "Couldn't save. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId: task.relocation_id,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "task.completed",
    entity: `task:${task.template_key}`,
    before: { status: task.status },
    after: { status: "done", proof: proofValue ?? "n/a" },
  });

  await recomputeRelocation(ctx.supabase, task.relocation_id);
  revalidateMove(task.relocation_id);
  return { ok: true };
}

const statusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
  blockedReason: z.string().trim().optional(),
});

/**
 * Change a task's status. `done` must go through completeTask when proof is
 * required; `blocked` requires a reason. Audit-logged; recomputes derived fields.
 */
export async function updateTaskStatus(input: {
  taskId: string;
  status: TaskStatus;
  blockedReason?: string;
}): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { taskId, status, blockedReason } = parsed.data;

  const loaded = await loadTaskForActor(taskId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx, task } = loaded;

  if (status === "done" && task.requires_proof) {
    return { ok: false, error: "This task needs proof — use Mark done with proof." };
  }
  if (status === "blocked" && !blockedReason?.trim()) {
    return { ok: false, error: "Add a reason when blocking a task." };
  }
  if (status !== "todo") {
    const lockedBy = await isLocked(ctx.supabase, task.relocation_id, task.template_key);
    if (lockedBy && status !== "blocked") {
      return { ok: false, error: "Finish the prerequisite task(s) first." };
    }
  }

  const patch: Record<string, unknown> = {
    status,
    blocked_reason: status === "blocked" ? blockedReason!.trim() : null,
  };
  if (status === "done") {
    patch.completed_at = new Date().toISOString();
    patch.completed_by = ctx.user.id;
  } else {
    patch.completed_at = null;
    patch.completed_by = null;
    // Moving away from done clears recorded proof for proof-gated tasks.
    patch.proof_value = task.requires_proof ? null : task.proof_value;
  }

  const { error } = await ctx.supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) return { ok: false, error: "Couldn't update. Please retry." };

  await logActivity(ctx.supabase, {
    relocationId: task.relocation_id,
    actorId: ctx.user.id,
    actorType: "ops",
    action: "task.status_changed",
    entity: `task:${task.template_key}`,
    before: { status: task.status },
    after: { status, blocked_reason: patch.blocked_reason },
  });

  await recomputeRelocation(ctx.supabase, task.relocation_id);
  revalidateMove(task.relocation_id);
  return { ok: true };
}
