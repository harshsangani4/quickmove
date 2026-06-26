import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TeamManager } from "@/components/ops/team-manager";

export default async function UsersPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: users }, { data: cities }] = await Promise.all([
    supabase.from("users").select("id, name, email, role, city_ids, active").order("role"),
    supabase.from("cities").select("id, name").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Team" description="Manage ops coordinators, leads, and admins." />
      <div className="p-6">
        <TeamManager
          currentUserId={user.id}
          users={users ?? []}
          cities={cities ?? []}
        />
      </div>
    </>
  );
}
