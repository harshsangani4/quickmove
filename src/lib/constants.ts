/**
 * Shared display metadata: stages, categories, and the semantic status palette
 * (build doc §10). Status is used as language — these maps drive chips, rings,
 * and labels identically across ops and portal.
 */
import type {
  Stage,
  RiskLevel,
  TaskStatus,
  TaskCategory,
  RelocationStatus,
} from "@/lib/types";

/** Ordered move stages (Intake → … → Done). Index = progression order. */
export const STAGE_ORDER: Stage[] = [
  "intake",
  "housing",
  "logistics",
  "utilities",
  "paperwork",
  "post_move",
  "done",
];

export const STAGE_META: Record<Stage, { label: string; customerLabel: string }> = {
  intake: { label: "Intake", customerLabel: "Getting started" },
  housing: { label: "Housing", customerLabel: "Finding your home" },
  logistics: { label: "Logistics", customerLabel: "Packers & movers" },
  utilities: { label: "Utilities", customerLabel: "Setting up utilities" },
  paperwork: { label: "Paperwork", customerLabel: "Address & documents" },
  post_move: { label: "Post-move", customerLabel: "Settling in" },
  done: { label: "Done", customerLabel: "Settled" },
};

/** Customer-facing timeline labels (build doc §6.1). */
export const CUSTOMER_TIMELINE: { stage: Stage; label: string }[] = [
  { stage: "intake", label: "Intake" },
  { stage: "housing", label: "Housing" },
  { stage: "logistics", label: "Logistics" },
  { stage: "utilities", label: "Utilities" },
  { stage: "paperwork", label: "Paperwork" },
  { stage: "post_move", label: "Settled" },
];

export const CATEGORY_META: Record<
  TaskCategory,
  { label: string; weight: number }
> = {
  apartment: { label: "Apartment", weight: 2 },
  movers: { label: "Packers & Movers", weight: 2 },
  utility: { label: "Utilities", weight: 1 },
  paperwork: { label: "Paperwork", weight: 1 },
  support: { label: "Support", weight: 1 },
};

/** Which category each stage is driven by (used to derive `stage`). */
export const CATEGORY_TO_STAGE: Record<TaskCategory, Stage> = {
  apartment: "housing",
  movers: "logistics",
  utility: "utilities",
  paperwork: "paperwork",
  support: "post_move",
};

export type StatusTone = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

/** tone → Tailwind classes (using the brand/status tokens defined in globals.css). */
export const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-muted text-success border-success/30",
  warning: "bg-warning-muted text-warning-foreground border-warning/40",
  danger: "bg-danger-muted text-danger border-danger/30",
  info: "bg-info-muted text-info border-info/20",
  brand: "bg-brand-muted text-brand border-brand/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export const RISK_META: Record<RiskLevel, { label: string; tone: StatusTone }> = {
  on_track: { label: "On track", tone: "success" },
  at_risk: { label: "At risk", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; tone: StatusTone }
> = {
  todo: { label: "To do", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  blocked: { label: "Blocked", tone: "danger" },
  done: { label: "Done", tone: "success" },
};

export const RELOCATION_STATUS_META: Record<
  RelocationStatus,
  { label: string; tone: StatusTone }
> = {
  active: { label: "Active", tone: "info" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const PROOF_TYPE_LABEL: Record<string, string> = {
  account_no: "Account number",
  photo: "Photo",
  doc: "Document",
  confirmation: "Confirmation",
};
