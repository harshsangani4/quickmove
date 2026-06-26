"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOpsContext, type ActionResult } from "./_helpers";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const ctx = await getOpsContext();
  if (!ctx.ok) return ctx;
  if (ctx.user.role !== "admin") {
    return { ok: false as const, error: "Only an admin can manage team members." };
  }
  return ctx;
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["ops", "lead", "admin"]),
  cityIds: z.array(z.string().uuid()),
});

/** Create a new ops user: a Supabase auth account + a matching public.users row. */
export async function createOpsUser(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, email, password, role, cityIds } = parsed.data;

  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;

  if (role === "ops" && cityIds.length === 0) {
    return { ok: false, error: "Assign at least one city for an ops user." };
  }

  const admin = createAdminClient();

  // 1) Create the auth user.
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authErr || !created?.user) {
    const msg = /already|exists|registered/i.test(authErr?.message ?? "")
      ? "A user with that email already exists."
      : "Couldn't create the account.";
    return { ok: false, error: msg };
  }

  // 2) Create the profile row. Roll back the auth user if this fails.
  const { error: profErr } = await admin.from("users").insert({
    id: created.user.id,
    name,
    email,
    role,
    city_ids: cityIds,
    active: true,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Couldn't save the profile. Please retry." };
  }

  revalidatePath("/users");
  return { ok: true };
}

/** Activate/deactivate a user — also bans/unbans their auth login. */
export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;
  if (userId === ctx.user.id) return { ok: false, error: "You can't deactivate yourself." };

  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ active }).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't update the user." };

  // Best-effort: block/allow sign-in at the auth layer too.
  try {
    await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  } catch {
    /* non-fatal */
  }

  revalidatePath("/users");
  return { ok: true };
}
