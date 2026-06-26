"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOpsContext, type ActionResult } from "./_helpers";
import { findDependencyCycle } from "@/lib/playbook/engine";

function revalidateCity(cityId: string) {
  revalidatePath(`/cities/${cityId}`);
  revalidatePath("/cities");
  revalidatePath("/vendors");
}

async function requireEditor() {
  const ctx = await getOpsContext();
  if (!ctx.ok) return ctx;
  if (ctx.user.role !== "admin" && ctx.user.role !== "lead") {
    return { ok: false as const, error: "Only a lead or admin can edit City Playbooks." };
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Task templates
// ---------------------------------------------------------------------------
const templateSchema = z.object({
  id: z.string().uuid().optional(),
  city_id: z.string().uuid(),
  key: z.string().trim().min(1).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, underscores."),
  title: z.string().trim().min(1),
  category: z.enum(["apartment", "movers", "utility", "paperwork", "support"]),
  lead_time_days: z.number().int().min(-90).max(90),
  depends_on: z.array(z.string()),
  requires_proof: z.boolean(),
  proof_type: z.enum(["account_no", "photo", "doc", "confirmation"]).nullable(),
  weight: z.number().int().min(1).max(5),
});

export async function upsertTemplate(input: z.input<typeof templateSchema>): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  }
  const t = parsed.data;
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;

  // Load sibling templates to validate the dependency graph for cycles (§5.4).
  const { data: siblings } = await ctx.supabase
    .from("task_templates")
    .select("id, key, depends_on")
    .eq("city_id", t.city_id);

  const graph = (siblings ?? [])
    .filter((s: any) => s.id !== t.id)
    .map((s: any) => ({ key: s.key, depends_on: s.depends_on ?? [] }));
  graph.push({ key: t.key, depends_on: t.depends_on });

  const cycle = findDependencyCycle(graph);
  if (cycle) {
    return { ok: false, error: `Circular dependency: ${cycle.join(" → ")}` };
  }

  const row = {
    city_id: t.city_id,
    key: t.key,
    title: t.title,
    category: t.category,
    lead_time_days: t.lead_time_days,
    depends_on: t.depends_on,
    requires_proof: t.requires_proof,
    proof_type: t.requires_proof ? t.proof_type : null,
    weight: t.weight,
  };

  const q = t.id
    ? ctx.supabase.from("task_templates").update(row).eq("id", t.id)
    : ctx.supabase.from("task_templates").insert(row);
  const { error } = await q;
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "A template with that key already exists." : "Couldn't save template.",
    };
  }
  revalidateCity(t.city_id);
  return { ok: true };
}

export async function deleteTemplate(
  templateId: string,
  opts: { force?: boolean } = {},
): Promise<ActionResult<{ referencedBy: string[] }>> {
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;

  const { data: tpl } = await ctx.supabase
    .from("task_templates")
    .select("key, city_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return { ok: false, error: "Template not found." };

  const { data: siblings } = await ctx.supabase
    .from("task_templates")
    .select("key, title, depends_on")
    .eq("city_id", tpl.city_id);
  const referencedBy = (siblings ?? [])
    .filter((s: any) => (s.depends_on ?? []).includes(tpl.key))
    .map((s: any) => s.title);

  if (referencedBy.length && !opts.force) {
    return { ok: false, error: `Referenced by: ${referencedBy.join(", ")}`, };
  }

  // On force-delete, strip the key from dependents so generation never breaks.
  if (referencedBy.length) {
    for (const s of siblings ?? []) {
      if ((s.depends_on ?? []).includes(tpl.key)) {
        await ctx.supabase
          .from("task_templates")
          .update({ depends_on: (s.depends_on as string[]).filter((k) => k !== tpl.key) })
          .eq("key", s.key)
          .eq("city_id", tpl.city_id);
      }
    }
  }

  const { error } = await ctx.supabase.from("task_templates").delete().eq("id", templateId);
  if (error) return { ok: false, error: "Couldn't delete template." };
  revalidateCity(tpl.city_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
const vendorSchema = z.object({
  id: z.string().uuid().optional(),
  city_id: z.string().uuid(),
  type: z.enum(["property", "movers"]),
  name: z.string().trim().min(1),
  contact: z.string().trim().optional(),
  on_time_pct: z.number().min(0).max(100),
  issue_rate: z.number().min(0).max(100),
  rating: z.number().min(0).max(5),
  active: z.boolean(),
});

export async function upsertVendor(input: z.input<typeof vendorSchema>): Promise<ActionResult> {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid vendor." };
  const v = parsed.data;
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;

  const row = { ...v };
  delete (row as any).id;
  const q = v.id
    ? ctx.supabase.from("vendors").update(row).eq("id", v.id)
    : ctx.supabase.from("vendors").insert(row);
  const { error } = await q;
  if (error) return { ok: false, error: "Couldn't save vendor." };
  revalidateCity(v.city_id);
  return { ok: true };
}

export async function setVendorActive(vendorId: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.from("vendors").update({ active }).eq("id", vendorId);
  if (error) return { ok: false, error: "Couldn't update vendor." };
  revalidatePath("/vendors");
  revalidatePath("/cities");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Utility providers
// ---------------------------------------------------------------------------
const utilitySchema = z.object({
  id: z.string().uuid().optional(),
  city_id: z.string().uuid(),
  type: z.enum(["electricity", "internet", "gas", "water"]),
  name: z.string().trim().min(1),
  avg_setup_days: z.number().int().min(0).max(60),
  contact: z.string().trim().optional(),
});

export async function upsertUtility(input: z.input<typeof utilitySchema>): Promise<ActionResult> {
  const parsed = utilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid utility provider." };
  const u = parsed.data;
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;
  const row = { ...u };
  delete (row as any).id;
  const q = u.id
    ? ctx.supabase.from("utility_providers").update(row).eq("id", u.id)
    : ctx.supabase.from("utility_providers").insert(row);
  const { error } = await q;
  if (error) return { ok: false, error: "Couldn't save utility provider." };
  revalidateCity(u.city_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Doc requirements
// ---------------------------------------------------------------------------
const docReqSchema = z.object({
  id: z.string().uuid().optional(),
  city_id: z.string().uuid(),
  name: z.string().trim().min(1),
  applies_to: z.enum(["customer", "relocation"]),
  mandatory: z.boolean(),
  notes: z.string().trim().optional(),
});

export async function upsertDocRequirement(input: z.input<typeof docReqSchema>): Promise<ActionResult> {
  const parsed = docReqSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid document requirement." };
  const d = parsed.data;
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;
  const row = { ...d };
  delete (row as any).id;
  const q = d.id
    ? ctx.supabase.from("doc_requirements").update(row).eq("id", d.id)
    : ctx.supabase.from("doc_requirements").insert(row);
  const { error } = await q;
  if (error) return { ok: false, error: "Couldn't save document requirement." };
  revalidateCity(d.city_id);
  return { ok: true };
}

export async function deleteDocRequirement(id: string, cityId: string): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.from("doc_requirements").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete." };
  revalidateCity(cityId);
  return { ok: true };
}

export async function deleteUtility(id: string, cityId: string): Promise<ActionResult> {
  const ctx = await requireEditor();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase.from("utility_providers").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete." };
  revalidateCity(cityId);
  return { ok: true };
}
