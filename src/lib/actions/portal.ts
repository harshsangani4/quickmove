"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyToken } from "@/lib/portal/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAIEnabled, extractAndValidateDocument } from "@/lib/ai/provider";
import type { ActionResult } from "./_helpers";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 8 * 1024 * 1024;

// --- Best-effort in-memory rate limiter (build doc §9) -----------------------
const buckets = new Map<string, number[]>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

async function authorize(token: string) {
  const res = await verifyToken(token);
  if (!res.ok) return { ok: false as const, error: "Your link is no longer valid. Please request a new one." };
  return { ok: true as const, relocationId: res.relocationId, customerId: res.customerId, db: createAdminClient() };
}

function revalidatePortal(token: string) {
  revalidatePath(`/portal/${token}`);
  revalidatePath(`/portal/${token}/home`);
  revalidatePath(`/portal/${token}/documents`);
  revalidatePath(`/portal/${token}/messages`);
}

async function logCustomer(db: any, relocationId: string, action: string, entity: string, after?: unknown) {
  try {
    await db.from("activity_log").insert({
      relocation_id: relocationId, actor_id: null, actor_type: "customer", action, entity, after: after ?? null,
    });
  } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
export async function approveApartment(token: string, apartmentId: string): Promise<ActionResult> {
  const ctx = await authorize(token);
  if (!ctx.ok) return ctx;
  const { db, relocationId } = ctx;

  const { data: apt } = await db.from("apartments").select("id, title").eq("id", apartmentId).eq("relocation_id", relocationId).maybeSingle();
  if (!apt) return { ok: false, error: "Apartment not found." };

  // Approve this one, reject the rest of the shortlist.
  await db.from("apartments").update({ status: "rejected" }).eq("relocation_id", relocationId).eq("status", "shortlisted");
  await db.from("apartments").update({ status: "approved" }).eq("id", apartmentId);
  await db.from("messages").insert({ relocation_id: relocationId, sender: "system", channel: "app", body: `Customer approved the apartment: ${apt.title}.` });
  await logCustomer(db, relocationId, "apartment.decided", "apartment", { decision: "approved", title: apt.title });
  revalidatePortal(token);
  return { ok: true };
}

const rejectSchema = z.object({ note: z.string().trim().max(500).optional() });
/** "Ask for other options" — rejects the whole current shortlist and pings ops. */
export async function rejectApartment(token: string, _apartmentId: string, note?: string): Promise<ActionResult> {
  const ctx = await authorize(token);
  if (!ctx.ok) return ctx;
  const parsed = rejectSchema.safeParse({ note });
  const { db, relocationId } = ctx;
  await db
    .from("apartments")
    .update({ status: "rejected", customer_note: parsed.success ? parsed.data.note ?? null : null })
    .eq("relocation_id", relocationId)
    .eq("status", "shortlisted");
  await db.from("messages").insert({ relocation_id: relocationId, sender: "system", channel: "app", body: `Customer requested other options${note ? `: ${note}` : ""}.` });
  await logCustomer(db, relocationId, "apartment.decided", "apartment", { decision: "more_options" });
  revalidatePortal(token);
  return { ok: true };
}

export async function uploadDocument(token: string, formData: FormData): Promise<ActionResult> {
  const ctx = await authorize(token);
  if (!ctx.ok) return ctx;
  const { db, relocationId, customerId } = ctx;

  if (!rateLimit(`upload:${relocationId}`, 10, 60_000)) {
    return { ok: false, error: "Too many uploads — please wait a minute and try again." };
  }

  const documentId = String(formData.get("documentId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Please choose a file." };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Allowed types: PDF, JPG, PNG." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File is too large (max 8 MB)." };

  const { data: doc } = await db.from("documents").select("id, type").eq("id", documentId).eq("relocation_id", relocationId).maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };

  // Store in the private bucket.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `customer/${relocationId}/${documentId}-${Date.now()}-${safeName}`;
  const { error: upErr } = await db.storage.from("documents").upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: "Upload failed. Please try again." };

  // Default: manual-review state. AI lights up validation when a key is present.
  let status: string = "uploaded";
  let extracted: unknown = null;
  let validation: unknown = null;
  let rejectReason: string | null = null;

  if (isAIEnabled()) {
    await db.from("documents").update({ status: "validating", file_url: path, uploaded_at: new Date().toISOString() }).eq("id", documentId);
    const { data: reloc } = await db
      .from("relocations")
      .select("customer:customers(name), apartments(title, locality)")
      .eq("id", relocationId)
      .maybeSingle();
    const { data: signed } = await db.storage.from("documents").createSignedUrl(path, 120);
    const result = await extractAndValidateDocument({
      docType: doc.type,
      expectedName: (reloc as any)?.customer?.name ?? "",
      expectedAddress: (reloc as any)?.apartments?.[0]?.locality ?? null,
      signedUrl: signed?.signedUrl ?? "",
      mimeType: file.type,
    });
    if (result.degraded) {
      status = "uploaded";
    } else {
      status = result.validated ? "validated" : "rejected";
      extracted = result.extracted;
      validation = { validated: result.validated };
      rejectReason = result.rejectReason;
    }
  }

  await db.from("documents").update({
    status,
    file_url: path,
    customer_id: customerId,
    extracted,
    validation,
    reject_reason: rejectReason,
    uploaded_at: new Date().toISOString(),
  }).eq("id", documentId);

  await db.from("messages").insert({ relocation_id: relocationId, sender: "system", channel: "app", body: `Customer uploaded ${doc.type}.` });
  await logCustomer(db, relocationId, "document.uploaded", `document:${doc.type}`, { status });
  revalidatePortal(token);
  return { ok: true, data: { status } as any };
}

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export async function sendCustomerMessage(token: string, body: string): Promise<ActionResult> {
  const ctx = await authorize(token);
  if (!ctx.ok) return ctx;
  const parsed = messageSchema.safeParse({ body });
  if (!parsed.success) return { ok: false, error: "Message can't be empty." };
  const { db, relocationId } = ctx;
  if (!rateLimit(`msg:${relocationId}`, 20, 60_000)) {
    return { ok: false, error: "Slow down a moment — too many messages." };
  }
  const { error } = await db.from("messages").insert({ relocation_id: relocationId, sender: "customer", channel: "app", body: parsed.data.body });
  if (error) return { ok: false, error: "Couldn't send. Please retry." };
  await logCustomer(db, relocationId, "message.sent", "message");
  revalidatePortal(token);
  return { ok: true };
}

const issueSchema = z.object({ body: z.string().trim().min(3).max(1000) });
export async function raiseIssue(token: string, body: string): Promise<ActionResult> {
  const ctx = await authorize(token);
  if (!ctx.ok) return ctx;
  const parsed = issueSchema.safeParse({ body });
  if (!parsed.success) return { ok: false, error: "Please describe the issue." };
  const { db, relocationId } = ctx;

  // Creates a support task on the ops side (build doc §6.10).
  const { data: owner } = await db.from("relocations").select("ops_owner_id").eq("id", relocationId).maybeSingle();
  await db.from("tasks").insert({
    relocation_id: relocationId,
    template_key: `support_issue_${Date.now()}`,
    title: `Customer issue: ${parsed.data.body.slice(0, 80)}`,
    category: "support",
    owner_id: owner?.ops_owner_id ?? null,
    status: "todo",
    due_date: new Date().toISOString().slice(0, 10),
    requires_proof: false,
  });
  await db.from("messages").insert({ relocation_id: relocationId, sender: "customer", channel: "app", body: `Raised an issue: ${parsed.data.body}` });
  await logCustomer(db, relocationId, "issue.raised", "support", { body: parsed.data.body.slice(0, 120) });
  revalidatePortal(token);
  return { ok: true };
}

export async function submitFeedback(token: string, score: number, comment: string): Promise<ActionResult> {
  const ctx = await authorize(token);
  if (!ctx.ok) return ctx;
  const { db, relocationId } = ctx;
  const s = Math.max(0, Math.min(10, Math.round(score)));
  await db.from("messages").insert({ relocation_id: relocationId, sender: "customer", channel: "app", body: `Feedback (${s}/10)${comment ? `: ${comment}` : ""}` });
  await logCustomer(db, relocationId, "feedback.submitted", "feedback", { score: s });
  revalidatePortal(token);
  return { ok: true };
}
