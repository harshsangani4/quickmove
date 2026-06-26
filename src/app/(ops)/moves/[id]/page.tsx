import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionChecklist, type ChecklistTask } from "@/components/ops/mission-checklist";
import { MoveQuickActions } from "@/components/ops/move-quick-actions";
import { ActivityFeed, type ActivityRow } from "@/components/ops/activity-feed";
import { MessageThread, type ThreadMessage } from "@/components/ops/message-thread";
import { EmptyState } from "@/components/empty-state";
import {
  RISK_META,
  STAGE_META,
  RELOCATION_STATUS_META,
  type StatusTone,
} from "@/lib/constants";
import { formatDate, relativeDays, formatINR } from "@/lib/format";
import { ArrowLeft, MapPin, ShieldAlert, Home, FileText, IndianRupee } from "lucide-react";
import type { RiskLevel, DocumentStatus } from "@/lib/types";

const DOC_TONE: Record<DocumentStatus, StatusTone> = {
  pending: "neutral",
  uploaded: "info",
  validating: "info",
  validated: "success",
  rejected: "danger",
};

export default async function MoveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: move } = await supabase
    .from("relocations")
    .select(
      "id, move_date, origin_city, stage, status, risk_level, progress_pct, customer:customers(name, email, phone), city:cities(name, slug), owner:users!relocations_ops_owner_id_fkey(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!move) notFound();

  const [
    { data: tasks },
    { data: documents },
    { data: apartments },
    { data: payments },
    { data: messages },
    { data: activity },
    { data: escalations },
    { data: users },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, template_key, title, category, status, due_date, blocked_reason, requires_proof, proof_type, proof_value, depends_on, sort_order, owner:users!tasks_owner_id_fkey(name)",
      )
      .eq("relocation_id", id)
      .order("sort_order", { ascending: true }),
    supabase.from("documents").select("id, type, status, reject_reason").eq("relocation_id", id),
    supabase.from("apartments").select("id, title, rent, bedrooms, locality, status").eq("relocation_id", id),
    supabase.from("payments").select("id, label, amount, status, due_date").eq("relocation_id", id),
    supabase.from("messages").select("id, sender, body, created_at").eq("relocation_id", id).order("created_at"),
    supabase
      .from("activity_log")
      .select("id, actor_id, actor_type, action, entity, created_at")
      .eq("relocation_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("escalations").select("id, reason, level, status").eq("relocation_id", id).eq("status", "open"),
    supabase.from("users").select("id, name"),
  ]);

  const m = move as any;
  const userMap = new Map((users ?? []).map((u: any) => [u.id, u.name]));
  const closed = m.status === "cancelled" || m.status === "completed";

  const checklistTasks: ChecklistTask[] = (tasks ?? []).map((t: any) => ({
    id: t.id,
    template_key: t.template_key,
    title: t.title,
    category: t.category,
    status: t.status,
    due_date: t.due_date,
    blocked_reason: t.blocked_reason,
    requires_proof: t.requires_proof,
    proof_type: t.proof_type,
    proof_value: t.proof_value,
    depends_on: t.depends_on ?? [],
    owner_name: t.owner?.name ?? null,
  }));

  const activityRows: ActivityRow[] = (activity ?? []).map((a: any) => ({
    id: a.id,
    actor_type: a.actor_type,
    action: a.action,
    entity: a.entity,
    created_at: a.created_at,
    actor_name: a.actor_id ? userMap.get(a.actor_id) ?? null : null,
  }));

  const threadMessages: ThreadMessage[] = (messages ?? []) as ThreadMessage[];
  const totalDue = (payments ?? []).filter((p: any) => p.status === "due").reduce((s: number, p: any) => s + p.amount, 0);
  const totalPaid = (payments ?? []).filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <>
      <PageHeader title={m.customer?.name ?? "Move"} description="Mission Control">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
      </PageHeader>

      <div className="space-y-6 p-6">
        {/* Escalation banner */}
        {(escalations ?? []).length > 0 && (
          <Card className="flex-row items-start gap-3 border-danger/40 bg-danger-muted/40 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-semibold text-danger">
                {escalations!.length} open escalation{escalations!.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {escalations!.map((e: any) => (
                  <li key={e.id}>• {e.reason} (level {e.level})</li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        {/* Header card */}
        <Card className="gap-4 p-5">
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing value={m.progress_pct} size={56} stroke={5} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{m.customer?.name}</h2>
                <StatusChip tone={RISK_META[m.risk_level as RiskLevel].tone}>
                  {RISK_META[m.risk_level as RiskLevel].label}
                </StatusChip>
                <StatusChip
                  tone={RELOCATION_STATUS_META[m.status as keyof typeof RELOCATION_STATUS_META].tone}
                  dot={false}
                >
                  {RELOCATION_STATUS_META[m.status as keyof typeof RELOCATION_STATUS_META].label}
                </StatusChip>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {m.origin_city} → {m.city?.name}
                </span>
                <span>Move date: {formatDate(m.move_date)} ({relativeDays(m.move_date)})</span>
                <span>Stage: {STAGE_META[m.stage as keyof typeof STAGE_META]?.label}</span>
                <span>Owner: {m.owner?.name ?? "Unassigned"}</span>
              </div>
            </div>
          </div>
          <MoveQuickActions
            relocationId={m.id}
            status={m.status}
            moveDate={m.move_date}
            customerName={m.customer?.name ?? "the customer"}
            isAdmin={user.role === "admin" || user.role === "lead"}
          />
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Checklist */}
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Checklist</h2>
            {checklistTasks.length === 0 ? (
              <EmptyState title="No tasks generated" description="This move has an empty checklist." />
            ) : (
              <MissionChecklist initialTasks={checklistTasks} readOnly={closed} />
            )}
          </div>

          {/* Right rail */}
          <div>
            <Card className="p-0">
              <Tabs defaultValue="activity" className="w-full gap-0">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                  <TabsTrigger value="activity" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-brand">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-brand">
                    Messages
                  </TabsTrigger>
                  <TabsTrigger value="info" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-brand">
                    Details
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="p-4">
                  <ActivityFeed rows={activityRows} />
                </TabsContent>

                <TabsContent value="messages" className="p-4">
                  <MessageThread relocationId={m.id} messages={threadMessages} readOnly={closed} />
                </TabsContent>

                <TabsContent value="info" className="space-y-5 p-4">
                  {/* Documents */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <FileText className="size-4" /> Documents
                    </div>
                    {(documents ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No documents yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {(documents ?? []).map((d: any) => (
                          <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{d.type}</span>
                            <StatusChip tone={DOC_TONE[d.status as DocumentStatus]} dot={false}>
                              {d.status}
                            </StatusChip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Apartments */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <Home className="size-4" /> Apartments
                    </div>
                    {(apartments ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No apartments shortlisted.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {(apartments ?? []).map((a: any) => (
                          <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">
                              {a.title}
                              {a.rent ? <span className="text-muted-foreground"> · {formatINR(a.rent)}</span> : null}
                            </span>
                            <StatusChip
                              tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "neutral"}
                              dot={false}
                            >
                              {a.status}
                            </StatusChip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Payments */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <IndianRupee className="size-4" /> Payments
                    </div>
                    {(payments ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No payments tracked.</p>
                    ) : (
                      <>
                        <ul className="space-y-1.5">
                          {(payments ?? []).map((p: any) => (
                            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{p.label}</span>
                              <span className="flex items-center gap-2">
                                <span className="tabular-nums">{formatINR(p.amount)}</span>
                                <StatusChip tone={p.status === "paid" ? "success" : "warning"} dot={false}>
                                  {p.status}
                                </StatusChip>
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex justify-between border-t pt-2 text-xs text-muted-foreground">
                          <span>Paid {formatINR(totalPaid)}</span>
                          <span>Due {formatINR(totalDue)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
