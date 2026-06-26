import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Building2, ChevronRight, Wrench, Truck, FileText, ListChecks } from "lucide-react";

export default async function CitiesPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "lead") redirect("/dashboard");
  const supabase = await createClient();

  const { data: cities } = await supabase.from("cities").select("id, name, slug").order("name");

  // Counts per city (small N, fetch all and tally).
  const [{ data: templates }, { data: vendors }, { data: utilities }, { data: docs }] =
    await Promise.all([
      supabase.from("task_templates").select("city_id"),
      supabase.from("vendors").select("city_id, active"),
      supabase.from("utility_providers").select("city_id"),
      supabase.from("doc_requirements").select("city_id"),
    ]);

  const tally = (rows: any[] | null, id: string) => (rows ?? []).filter((r) => r.city_id === id).length;

  return (
    <>
      <PageHeader
        title="City Playbooks"
        description="Each city is data — its vendors, utilities, document rules, and task templates. Edits apply to future moves only."
      />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {(cities ?? []).map((c) => (
          <Link key={c.id} href={`/cities/${c.id}`}>
            <Card className="gap-3 p-5 transition-colors hover:border-brand/40 hover:bg-accent/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-brand-muted text-brand">
                    <Building2 className="size-5" />
                  </div>
                  <span className="font-semibold">{c.name}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ListChecks className="size-3.5" /> {tally(templates, c.id)} tasks</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="size-3.5" /> {tally(vendors, c.id)} vendors</span>
                <span className="inline-flex items-center gap-1.5"><Wrench className="size-3.5" /> {tally(utilities, c.id)} utilities</span>
                <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" /> {tally(docs, c.id)} docs</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
