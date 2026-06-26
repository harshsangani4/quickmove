import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CityEditor } from "@/components/ops/city-editor";
import { ArrowLeft } from "lucide-react";

export default async function CityEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "lead") redirect("/dashboard");
  const supabase = await createClient();

  const { data: city } = await supabase.from("cities").select("id, name, slug").eq("id", id).maybeSingle();
  if (!city) notFound();

  const [{ data: templates }, { data: vendors }, { data: utilities }, { data: docs }, { count: activeMoves }] =
    await Promise.all([
      supabase.from("task_templates").select("*").eq("city_id", id).order("lead_time_days"),
      supabase.from("vendors").select("*").eq("city_id", id).order("type"),
      supabase.from("utility_providers").select("*").eq("city_id", id).order("type"),
      supabase.from("doc_requirements").select("*").eq("city_id", id).order("name"),
      supabase
        .from("relocations")
        .select("id", { count: "exact", head: true })
        .eq("destination_city_id", id)
        .eq("status", "active"),
    ]);

  return (
    <>
      <PageHeader title={`${city.name} Playbook`} description="Edits apply to future moves only.">
        <Link href="/cities" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All cities
        </Link>
      </PageHeader>
      <div className="p-6">
        <CityEditor
          cityId={city.id}
          activeMoves={activeMoves ?? 0}
          templates={templates ?? []}
          vendors={vendors ?? []}
          utilities={utilities ?? []}
          docs={docs ?? []}
        />
      </div>
    </>
  );
}
