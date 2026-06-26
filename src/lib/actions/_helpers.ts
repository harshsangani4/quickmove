import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { computeDerived, type DerivableTask } from "@/lib/playbook/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@/lib/types";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Resolve the signed-in ops user + an RLS-scoped client, or fail cleanly. */
export async function getOpsContext(): Promise<
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're signed out. Please sign in again." };
  const supabase = await createClient();
  return { ok: true, user, supabase };
}

/** Write an audit row. Failures here never block the primary mutation. */
export async function logActivity(
  supabase: SupabaseClient,
  entry: {
    relocationId: string;
    actorId: string | null;
    actorType: "ops" | "customer" | "system";
    action: string;
    entity?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  try {
    await supabase.from("activity_log").insert({
      relocation_id: entry.relocationId,
      actor_id: entry.actorId,
      actor_type: entry.actorType,
      action: entry.action,
      entity: entry.entity ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch {
    // Best-effort audit; swallow so the user's action still succeeds.
  }
}

/**
 * Recompute a relocation's derived fields from its current tasks and persist
 * them. Never overrides risk for completed/cancelled moves. Returns the derived
 * values for callers that want to surface them.
 */
export async function recomputeRelocation(
  supabase: SupabaseClient,
  relocationId: string,
) {
  const { data: reloc } = await supabase
    .from("relocations")
    .select("move_date, status")
    .eq("id", relocationId)
    .maybeSingle();
  if (!reloc) return null;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("category, status, due_date, depends_on, template_key")
    .eq("relocation_id", relocationId);

  const derived = computeDerived((tasks ?? []) as DerivableTask[], reloc.move_date);

  const terminal = reloc.status === "completed" || reloc.status === "cancelled";
  const patch: Record<string, unknown> = {
    progress_pct: derived.progress_pct,
    stage: terminal ? (reloc.status === "completed" ? "done" : undefined) : derived.stage,
  };
  if (!terminal) patch.risk_level = derived.risk_level;
  // Drop undefined keys so we don't null out columns.
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  await supabase.from("relocations").update(patch).eq("id", relocationId);
  return derived;
}
