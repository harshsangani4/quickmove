/**
 * Portal data access. Always scoped to ONE relocation_id (the one the verified
 * magic link grants). Uses the service role but every query is filtered to that
 * relocation — the customer can never reach another move (build doc §4, §9).
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getPortalSummary(relocationId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("relocations")
    .select(
      "id, move_date, origin_city, stage, status, risk_level, progress_pct, customer:customers(name, email), city:cities(name, slug)",
    )
    .eq("id", relocationId)
    .maybeSingle();
  return data as any;
}

export interface ActionItem {
  id: string;
  kind: "document" | "apartment";
  title: string;
  description: string;
  href: string;
  urgent: boolean;
}

/** "What we need from you" (build doc §6.2) — derived, deadline-aware. */
export async function getActionItems(relocationId: string, token: string): Promise<ActionItem[]> {
  const db = createAdminClient();
  const items: ActionItem[] = [];

  const { data: docs } = await db
    .from("documents")
    .select("id, type, status, reject_reason")
    .eq("relocation_id", relocationId);
  for (const d of docs ?? []) {
    if (d.status === "pending") {
      items.push({
        id: `doc-${d.id}`,
        kind: "document",
        title: `Upload your ${d.type}`,
        description: "We need this to keep your move on track.",
        href: `/portal/${token}/documents`,
        urgent: false,
      });
    } else if (d.status === "rejected") {
      items.push({
        id: `doc-${d.id}`,
        kind: "document",
        title: `Re-upload your ${d.type}`,
        description: d.reject_reason ?? "This document needs another look.",
        href: `/portal/${token}/documents`,
        urgent: true,
      });
    }
  }

  const { data: apts } = await db
    .from("apartments")
    .select("id, status")
    .eq("relocation_id", relocationId);
  const hasApproved = (apts ?? []).some((a) => a.status === "approved");
  const hasShortlist = (apts ?? []).some((a) => a.status === "shortlisted");
  if (hasShortlist && !hasApproved) {
    items.push({
      id: "apt-decide",
      kind: "apartment",
      title: "Review & approve your home",
      description: "Your coordinator shortlisted options — pick the one you love.",
      href: `/portal/${token}/home`,
      urgent: false,
    });
  }

  return items;
}

export async function getApartments(relocationId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("apartments")
    .select("id, title, rent, bedrooms, locality, commute_min, photos, status, customer_note")
    .eq("relocation_id", relocationId)
    .order("rent", { ascending: true });
  return data ?? [];
}

export async function getDocuments(relocationId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("documents")
    .select("id, type, status, reject_reason, file_url, uploaded_at, created_at")
    .eq("relocation_id", relocationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Utilities (electricity/internet/gas/water) + address-change board (build doc §6.5). */
export async function getStatusBoard(relocationId: string) {
  const db = createAdminClient();
  const { data: tasks } = await db
    .from("tasks")
    .select("template_key, title, status, proof_value, due_date, category")
    .eq("relocation_id", relocationId);

  const utilKeys: Record<string, string> = {
    electricity_setup: "Electricity",
    internet_setup: "Internet",
    gas_setup: "Gas",
    water_setup: "Water",
  };
  const paperKeys: Record<string, string> = {
    bank_address_change: "Bank address",
    id_address_change: "ID / Aadhaar",
    subscriptions_update: "Subscriptions",
    police_verification: "Police verification",
  };

  const pick = (keys: Record<string, string>) =>
    (tasks ?? [])
      .filter((t) => keys[t.template_key])
      .map((t) => ({
        label: keys[t.template_key],
        status: t.status,
        reference: t.proof_value,
        due_date: t.due_date,
      }));

  return { utilities: pick(utilKeys), paperwork: pick(paperKeys) };
}

export async function getMessages(relocationId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("messages")
    .select("id, sender, body, created_at")
    .eq("relocation_id", relocationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getPayments(relocationId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("payments")
    .select("id, label, amount, currency, status, due_date, invoice_url")
    .eq("relocation_id", relocationId)
    .order("due_date", { ascending: true });
  return data ?? [];
}

/** Move-day live tracker steps (build doc §6.6), derived from movers tasks. */
export async function getMoveDayStatus(relocationId: string) {
  const db = createAdminClient();
  const { data: tasks } = await db
    .from("tasks")
    .select("template_key, status")
    .eq("relocation_id", relocationId)
    .in("template_key", ["movers_book", "packing_day", "move_day"]);
  const byKey = new Map((tasks ?? []).map((t) => [t.template_key, t.status]));

  // Map task states → a 6-step strip.
  const steps = ["Scheduled", "Team assigned", "En route", "Loading", "In transit", "Delivered"];
  let current = 0;
  if (byKey.get("movers_book") === "done") current = 1;
  if (byKey.get("packing_day") === "in_progress") current = 2;
  if (byKey.get("packing_day") === "done") current = 3;
  if (byKey.get("move_day") === "in_progress") current = 4;
  if (byKey.get("move_day") === "done") current = 5;
  return { steps, current };
}
