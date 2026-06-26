import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { PipelineBoard, type BoardMove } from "@/components/ops/pipeline-board";
import { isOverdue } from "@/lib/format";

export default async function PipelinePage() {
  await requireUser();
  const supabase = await createClient();

  const { data: relocations, error } = await supabase
    .from("relocations")
    .select(
      "id, move_date, stage, status, risk_level, progress_pct, ops_owner_id, customer:customers(name), city:cities(name, slug), owner:users!relocations_ops_owner_id_fkey(name)",
    )
    .neq("status", "cancelled")
    .order("move_date", { ascending: true });

  if (error) {
    return (
      <>
        <PageHeader title="Pipeline" description="Every move, by stage and city" />
        <div className="p-6">
          <Card className="border-danger/30 bg-danger-muted/40 p-6">
            <div className="flex items-center gap-2 text-danger">
              <ShieldAlert className="size-5" />
              <span className="font-medium">Couldn&apos;t load the pipeline</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Refresh to try again.</p>
          </Card>
        </div>
      </>
    );
  }

  const rows = (relocations ?? []) as any[];
  const ids = rows.map((r) => r.id);

  // Fetch tasks to derive a "current blocker" per move (blocked first, then overdue).
  const { data: tasks } = ids.length
    ? await supabase
        .from("tasks")
        .select("relocation_id, title, status, due_date")
        .in("relocation_id", ids)
    : { data: [] as any[] };

  const blockerByMove = new Map<string, string>();
  for (const t of tasks ?? []) {
    if (blockerByMove.has(t.relocation_id)) {
      // Prefer a blocked task over an overdue one — overwrite only if current is overdue-type.
    }
    if (t.status === "blocked") {
      blockerByMove.set(t.relocation_id, `Blocked: ${t.title}`);
    }
  }
  for (const t of tasks ?? []) {
    if (blockerByMove.has(t.relocation_id)) continue;
    if (t.status !== "done" && isOverdue(t.due_date)) {
      blockerByMove.set(t.relocation_id, `Overdue: ${t.title}`);
    }
  }

  const moves: BoardMove[] = rows.map((r) => ({
    id: r.id,
    customerName: r.customer?.name ?? "Unknown",
    citySlug: r.city?.slug ?? "unknown",
    cityName: r.city?.name ?? "Unknown",
    ownerId: r.ops_owner_id,
    ownerName: r.owner?.name ?? null,
    moveDate: r.move_date,
    stage: r.stage,
    status: r.status,
    riskLevel: r.risk_level,
    progressPct: r.progress_pct,
    blocker: blockerByMove.get(r.id) ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Every move as a card — grouped by city, organised by stage."
      />
      <PipelineBoard moves={moves} />
    </>
  );
}
