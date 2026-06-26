"use server";

import { getOpsContext } from "./_helpers";
import { isAIEnabled, copilotAnswer } from "@/lib/ai/provider";
import { riskReasons } from "@/lib/playbook/engine";

export interface CopilotReply {
  ok: boolean;
  answer: string;
  draft: string | null;
  degraded: boolean; // true => computed answer (AI offline)
  error?: string;
}

/**
 * Ops copilot (build doc §5.6). With an OpenAI key it answers from real move
 * context; without one (or on failure) it returns a deterministic answer computed
 * from the DB. It can only DRAFT a message — never sends.
 */
export async function askCopilot(question: string, relocationId?: string): Promise<CopilotReply> {
  const ctx = await getOpsContext();
  if (!ctx.ok) return { ok: false, answer: "", draft: null, degraded: true, error: ctx.error };
  const q = question.trim();
  if (!q) return { ok: false, answer: "", draft: null, degraded: true, error: "Ask a question." };

  const { supabase } = ctx;

  // ---- Build context ----
  let contextText = "";
  let computed: { answer: string; draft: string | null };

  if (relocationId) {
    const { data: move } = await supabase
      .from("relocations")
      .select("id, move_date, stage, status, risk_level, progress_pct, customer:customers(name), city:cities(name)")
      .eq("id", relocationId)
      .maybeSingle();
    if (!move) return { ok: false, answer: "", draft: null, degraded: true, error: "Move not found." };
    const { data: tasks } = await supabase
      .from("tasks")
      .select("title, status, due_date, blocked_reason, category, template_key")
      .eq("relocation_id", relocationId);
    const m = move as any;
    const blocked = (tasks ?? []).filter((t) => t.status === "blocked");
    const reasons = riskReasons((tasks ?? []) as any, m.move_date);

    contextText = [
      `Customer: ${m.customer?.name}`,
      `Destination: ${m.city?.name}`,
      `Move date: ${m.move_date}`,
      `Stage: ${m.stage}, Risk: ${m.risk_level}, Progress: ${m.progress_pct}%`,
      `Tasks:`,
      ...(tasks ?? []).map((t) => `- ${t.title} [${t.status}]${t.blocked_reason ? ` (blocked: ${t.blocked_reason})` : ""} due ${t.due_date}`),
    ].join("\n");

    computed = computeMoveAnswer(q, m, blocked, reasons);
  } else {
    const { data: moves } = await supabase
      .from("relocations")
      .select("id, move_date, risk_level, progress_pct, customer:customers(name), city:cities(name)")
      .eq("status", "active")
      .neq("risk_level", "on_track");
    const list = (moves ?? []) as any[];
    contextText = [
      `Active at-risk / critical moves:`,
      ...list.map((m) => `- ${m.customer?.name} → ${m.city?.name}, ${m.risk_level}, moves ${m.move_date}, ${m.progress_pct}% done`),
    ].join("\n");
    computed = computeGlobalAnswer(q, list);
  }

  // ---- AI path (falls back to computed) ----
  if (isAIEnabled()) {
    const ai = await copilotAnswer(q, contextText);
    if (ai) return { ok: true, answer: ai.answer, draft: ai.draft, degraded: false };
  }
  return { ok: true, answer: computed.answer, draft: computed.draft, degraded: true };
}

function computeMoveAnswer(
  q: string,
  m: any,
  blocked: any[],
  reasons: string[],
): { answer: string; draft: string | null } {
  const lower = q.toLowerCase();
  const name = m.customer?.name ?? "the customer";
  const city = m.city?.name ?? "your new city";

  if (lower.includes("draft") || lower.includes("message") || lower.includes("whatsapp") || lower.includes("email") || lower.includes("update")) {
    const issue = blocked[0]?.blocked_reason || reasons[0] || "everything is progressing well";
    const draft = `Hi ${name.split(" ")[0]}, a quick update on your move to ${city}: ${issue}. We're on it and will keep you posted. — Team QuickMove`;
    return { answer: "Here's a draft you can review and send:", draft };
  }
  if (lower.includes("block")) {
    if (blocked.length === 0 && reasons.length === 0) return { answer: `Nothing is blocking ${name}'s move right now.`, draft: null };
    const lines = [
      ...blocked.map((b) => `• ${b.title} — blocked${b.blocked_reason ? `: ${b.blocked_reason}` : ""}`),
      ...reasons.filter((r) => !blocked.some((b) => r.startsWith(b.title))).map((r) => `• ${r}`),
    ];
    return { answer: `What's holding up ${name}'s move:\n${lines.join("\n")}`, draft: null };
  }
  return {
    answer: `${name}'s move to ${city} is ${m.progress_pct}% done (stage: ${m.stage}, risk: ${m.risk_level}). ${reasons.length ? `Watch-outs: ${reasons.join("; ")}.` : "No issues flagged."}`,
    draft: null,
  };
}

function computeGlobalAnswer(q: string, moves: any[]): { answer: string; draft: string | null } {
  if (moves.length === 0) return { answer: "No moves are at risk right now — all clear.", draft: null };
  const lines = moves
    .sort((a, b) => (a.risk_level === "critical" ? -1 : 1))
    .map((m) => `• ${m.customer?.name} → ${m.city?.name}: ${m.risk_level.replace("_", " ")}, moves ${m.move_date}, ${m.progress_pct}% done`);
  return { answer: `${moves.length} move(s) need attention:\n${lines.join("\n")}`, draft: null };
}
