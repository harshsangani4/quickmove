/**
 * Single swappable AI provider (build doc §7). Server-only.
 *
 * Reads OPENAI_API_KEY server-side. If absent, isAIEnabled() is false and every
 * consumer falls back to a deterministic/manual path. Every call is wrapped in
 * try/catch with a timeout + one retry; on failure we degrade — an AI failure
 * must NEVER block the workflow.
 */
import "server-only";
import OpenAI from "openai";
import { serverEnv } from "@/lib/env";
import { documentExtractionPrompt, copilotSystemPrompt } from "@/lib/ai/prompts";

export function isAIEnabled(): boolean {
  return Boolean(serverEnv.openaiApiKey);
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: serverEnv.openaiApiKey,
      timeout: 20_000,
      maxRetries: 1,
    });
  }
  return _client;
}

function parseJSON<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Document extraction + validation
// ---------------------------------------------------------------------------
export interface DocValidationResult {
  extracted: Record<string, unknown> | null;
  validated: boolean;
  rejectReason: string | null;
  degraded: boolean; // true => AI unavailable / failed; caller uses manual-review state
}

export async function extractAndValidateDocument(input: {
  docType: string;
  expectedName: string;
  expectedAddress?: string | null;
  signedUrl: string;
  mimeType: string;
}): Promise<DocValidationResult> {
  if (!isAIEnabled()) {
    return { extracted: null, validated: false, rejectReason: null, degraded: true };
  }
  try {
    const prompt = documentExtractionPrompt({
      docType: input.docType,
      expectedName: input.expectedName,
      expectedAddress: input.expectedAddress ?? null,
    });
    const res = await client().chat.completions.create({
      model: serverEnv.openaiVisionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: input.signedUrl } },
          ] as never,
        },
      ],
      max_tokens: 500,
    });
    const parsed = parseJSON<{
      extracted: Record<string, unknown>;
      is_valid: boolean;
      reason: string;
    }>(res.choices[0]?.message?.content);

    if (!parsed) {
      return { extracted: null, validated: false, rejectReason: null, degraded: true };
    }
    return {
      extracted: parsed.extracted ?? null,
      validated: Boolean(parsed.is_valid),
      rejectReason: parsed.is_valid ? null : parsed.reason || "Document didn't match your booking.",
      degraded: false,
    };
  } catch {
    // AI failure must never block the upload — fall back to manual review.
    return { extracted: null, validated: false, rejectReason: null, degraded: true };
  }
}

// ---------------------------------------------------------------------------
// Ops copilot
// ---------------------------------------------------------------------------
export interface CopilotResult {
  answer: string;
  draft: string | null;
  degraded: boolean;
}

/** AI path only. Returns null on failure so the caller can use the computed path. */
export async function copilotAnswer(
  question: string,
  contextText: string,
): Promise<CopilotResult | null> {
  if (!isAIEnabled()) return null;
  try {
    const res = await client().chat.completions.create({
      model: serverEnv.openaiTextModel,
      messages: [
        { role: "system", content: copilotSystemPrompt() },
        { role: "user", content: `MOVE CONTEXT:\n${contextText}\n\nQUESTION: ${question}` },
      ],
      max_tokens: 600,
    });
    const parsed = parseJSON<{ answer: string; draft_message: string | null }>(
      res.choices[0]?.message?.content,
    );
    if (!parsed?.answer) return null;
    return { answer: parsed.answer, draft: parsed.draft_message ?? null, degraded: false };
  } catch {
    return null;
  }
}
