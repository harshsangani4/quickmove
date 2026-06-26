/**
 * The City Playbook engine (build doc §3) — the spine of the product.
 *
 * A relocation's entire task timeline is GENERATED from the destination city's
 * task_templates + move_date. Nothing here is city-specific in code: every
 * per-city difference comes in as data (templates with different lead times,
 * dependencies, proof rules). These functions are pure so they can run in the
 * seed script and in server actions identically.
 */
import {
  addDays,
  differenceInCalendarDays,
  formatISO,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import type {
  ProofType,
  RiskLevel,
  Stage,
  TaskCategory,
  TaskStatus,
  TaskTemplate,
} from "@/lib/types";
import { CATEGORY_META, CATEGORY_TO_STAGE, STAGE_ORDER } from "@/lib/constants";

export interface GeneratedTask {
  template_key: string;
  title: string;
  category: TaskCategory;
  owner_id: string | null;
  due_date: string; // ISO date (YYYY-MM-DD)
  status: TaskStatus;
  requires_proof: boolean;
  proof_type: ProofType | null;
  depends_on: string[];
  sort_order: number;
}

export interface GenerationResult {
  tasks: GeneratedTask[];
  warnings: string[];
  /** True when some task is already overdue at creation (compressed timeline). */
  compressed: boolean;
}

export class PastMoveDateError extends Error {
  constructor() {
    super("Move date is in the past — choose a future date.");
    this.name = "PastMoveDateError";
  }
}

function toISODate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/**
 * Generate the full task list for a move.
 * @throws PastMoveDateError if move_date is before today (edge case §3).
 */
export function generateTasks(
  templates: TaskTemplate[],
  moveDate: string,
  opsUserIds: string[],
  now: Date = new Date(),
  opts: { allowPastDate?: boolean } = {},
): GenerationResult {
  const today = startOfDay(now);
  const move = startOfDay(parseISO(moveDate));

  if (isBefore(move, today) && !opts.allowPastDate) {
    throw new PastMoveDateError();
  }

  const warnings: string[] = [];
  const validKeys = new Set(templates.map((t) => t.key));

  // Stable ordering: by lead time (earliest action first), then category order.
  const ordered = [...templates].sort((a, b) => {
    if (a.lead_time_days !== b.lead_time_days) return a.lead_time_days - b.lead_time_days;
    return (
      STAGE_ORDER.indexOf(CATEGORY_TO_STAGE[a.category]) -
      STAGE_ORDER.indexOf(CATEGORY_TO_STAGE[b.category])
    );
  });

  let rr = 0;
  let compressed = false;

  const tasks: GeneratedTask[] = ordered.map((t, i) => {
    const dueDate = addDays(move, t.lead_time_days);
    if (isBefore(dueDate, today)) compressed = true;

    // Wire dependencies, skipping (with a warning) any that don't exist (§3).
    const depends_on = (t.depends_on ?? []).filter((dep) => {
      if (validKeys.has(dep)) return true;
      warnings.push(
        `Template "${t.key}" depends on "${dep}" which does not exist in this city — dependency skipped.`,
      );
      return false;
    });

    const owner_id = opsUserIds.length ? opsUserIds[rr++ % opsUserIds.length] : null;

    return {
      template_key: t.key,
      title: t.title,
      category: t.category,
      owner_id,
      due_date: toISODate(dueDate),
      status: "todo" as TaskStatus,
      requires_proof: t.requires_proof,
      proof_type: t.proof_type,
      depends_on,
      sort_order: i,
    };
  });

  return { tasks, warnings, compressed };
}

/** Minimal task shape the derivation needs (works for GeneratedTask and DB rows). */
export interface DerivableTask {
  category: TaskCategory;
  status: TaskStatus;
  due_date: string | null;
  depends_on?: string[];
  template_key?: string;
}

export interface DerivedFields {
  progress_pct: number;
  risk_level: RiskLevel;
  stage: Stage;
}

const DONE: TaskStatus = "done";

/** Weighted % of tasks done, weighting by category (build doc §3). */
export function computeProgress(tasks: DerivableTask[]): number {
  if (tasks.length === 0) return 0;
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    const w = CATEGORY_META[t.category]?.weight ?? 1;
    total += w;
    if (t.status === DONE) done += w;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * Stage = the furthest category (in progression order) that still has an open
 * task. All done → 'done'. No tasks → 'intake'. (build doc §3)
 */
export function computeStage(tasks: DerivableTask[]): Stage {
  if (tasks.length === 0) return "intake";
  const open = tasks.filter((t) => t.status !== DONE);
  if (open.length === 0) return "done";
  let furthest = -1;
  for (const t of open) {
    const idx = STAGE_ORDER.indexOf(CATEGORY_TO_STAGE[t.category]);
    if (idx > furthest) furthest = idx;
  }
  return STAGE_ORDER[Math.max(0, furthest)] ?? "intake";
}

/**
 * Risk level (build doc §3):
 *  - critical: any incomplete task overdue, OR a blocked task on the critical
 *    path to move_date (a blocked core task due on/before the move date).
 *  - at_risk: any task due within 48h and not started, OR projected completion
 *    overshoots move_date (an incomplete task is due after the move date).
 *  - else on_track.
 */
export function computeRisk(
  tasks: DerivableTask[],
  moveDate: string,
  now: Date = new Date(),
): RiskLevel {
  const today = startOfDay(now);
  const move = startOfDay(parseISO(moveDate));
  const incomplete = tasks.filter((t) => t.status !== DONE);

  const coreCategories: TaskCategory[] = ["apartment", "movers", "utility"];

  let critical = false;
  let atRisk = false;

  for (const t of incomplete) {
    const due = t.due_date ? startOfDay(parseISO(t.due_date)) : null;

    if (due && isBefore(due, today)) critical = true; // overdue
    if (
      t.status === "blocked" &&
      coreCategories.includes(t.category) &&
      due &&
      !isBefore(move, due) // due on/before move date → on the critical path
    ) {
      critical = true;
    }

    if (due) {
      const daysToDue = differenceInCalendarDays(due, today);
      if (daysToDue >= 0 && daysToDue <= 2 && t.status === "todo") atRisk = true;
      // Overshoot only counts for tasks expected BEFORE the move (core categories).
      // Post-move paperwork/support legitimately falls after the move date.
      if (coreCategories.includes(t.category) && isBefore(move, due)) atRisk = true;
    }
  }

  if (critical) return "critical";
  if (atRisk) return "at_risk";
  return "on_track";
}

export function computeDerived(
  tasks: DerivableTask[],
  moveDate: string,
  now: Date = new Date(),
): DerivedFields {
  return {
    progress_pct: computeProgress(tasks),
    risk_level: computeRisk(tasks, moveDate, now),
    stage: computeStage(tasks),
  };
}

/** Human-readable reasons a move is at risk, for the Risk Radar (build doc §5.1). */
export function riskReasons(
  tasks: (DerivableTask & { title?: string; blocked_reason?: string | null })[],
  moveDate: string,
  now: Date = new Date(),
): string[] {
  const today = startOfDay(now);
  const move = startOfDay(parseISO(moveDate));
  const reasons: string[] = [];

  for (const t of tasks) {
    if (t.status === DONE) continue;
    const due = t.due_date ? startOfDay(parseISO(t.due_date)) : null;
    const title = t.title ?? t.template_key ?? "A task";

    if (due && isBefore(due, today)) {
      const days = Math.abs(differenceInCalendarDays(due, today));
      reasons.push(`${title} overdue ${days} day${days === 1 ? "" : "s"}`);
    } else if (t.status === "blocked") {
      reasons.push(`${title} blocked${t.blocked_reason ? `: ${t.blocked_reason}` : ""}`);
    } else if (due) {
      const daysToDue = differenceInCalendarDays(due, today);
      if (daysToDue >= 0 && daysToDue <= 2 && t.status === "todo") {
        reasons.push(`${title} due in ${daysToDue} day${daysToDue === 1 ? "" : "s"}, not started`);
      } else if (
        ["apartment", "movers", "utility"].includes(t.category) &&
        isBefore(move, due)
      ) {
        reasons.push(`${title} is scheduled after the move date`);
      }
    }
  }
  return reasons;
}

/**
 * Which template keys are blocked because a dependency isn't done yet.
 * Used by Mission Control to render a task as "waiting on: <task>" (§5.3).
 */
export function lockedByDependencies(
  tasks: { template_key: string; status: TaskStatus; depends_on: string[] }[],
): Record<string, string[]> {
  const statusByKey = new Map(tasks.map((t) => [t.template_key, t.status]));
  const locked: Record<string, string[]> = {};
  for (const t of tasks) {
    const unmet = (t.depends_on ?? []).filter((dep) => statusByKey.get(dep) !== "done");
    if (unmet.length) locked[t.template_key] = unmet;
  }
  return locked;
}

/**
 * Detect a cycle in a template dependency graph (build doc §5.4).
 * Returns the cycle path if one exists, else null.
 */
export function findDependencyCycle(
  templates: { key: string; depends_on: string[] }[],
): string[] | null {
  const graph = new Map(templates.map((t) => [t.key, t.depends_on ?? []]));
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (!graph.has(dep)) continue; // missing dep handled elsewhere
      const c = color.get(dep) ?? WHITE;
      if (c === GRAY) {
        const idx = stack.indexOf(dep);
        return [...stack.slice(idx), dep];
      }
      if (c === WHITE) {
        const found = dfs(dep);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const t of templates) {
    if ((color.get(t.key) ?? WHITE) === WHITE) {
      const cycle = dfs(t.key);
      if (cycle) return cycle;
    }
  }
  return null;
}
