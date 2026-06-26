import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ops/stat-card";
import { StatusChip } from "@/components/status-chip";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { RISK_META } from "@/lib/constants";
import { STAGE_META } from "@/lib/constants";
import { relativeDays, formatDate, isOverdue } from "@/lib/format";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ListTodo,
  Boxes,
  ShieldAlert,
} from "lucide-react";
import { riskReasons } from "@/lib/playbook/engine";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { RiskLevel, Stage } from "@/lib/types";

interface RelocRow {
  id: string;
  move_date: string;
  stage: Stage;
  status: string;
  risk_level: RiskLevel;
  progress_pct: number;
  customer: { name: string } | null;
  city: { name: string; slug: string } | null;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: relocations, error } = await supabase
    .from("relocations")
    .select(
      "id, move_date, stage, status, risk_level, progress_pct, customer:customers(name), city:cities(name, slug)",
    )
    .neq("status", "cancelled")
    .order("move_date", { ascending: true });

  const { data: myTasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, status, relocation_id, relocation:relocations(customer:customers(name))")
    .eq("owner_id", user.id)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(8);

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Risk Radar + today's actions" />
        <div className="p-6">
          <Card className="border-danger/30 bg-danger-muted/40 p-6">
            <div className="flex items-center gap-2 text-danger">
              <ShieldAlert className="size-5" />
              <span className="font-medium">We couldn&apos;t load your moves</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Something went wrong fetching the dashboard. Refresh the page to try again.
            </p>
          </Card>
        </div>
      </>
    );
  }

  const rows = (relocations ?? []) as unknown as RelocRow[];
  const active = rows.filter((r) => r.status === "active");
  const atRisk = active.filter((r) => r.risk_level === "at_risk");
  const critical = active.filter((r) => r.risk_level === "critical");
  const thisWeek = active.filter((r) => {
    const d = differenceInCalendarDays(parseISO(r.move_date), new Date());
    return d >= 0 && d <= 7;
  });

  // Risk Radar: critical first, then at-risk, soonest move first.
  const radar = [...critical, ...atRisk].sort((a, b) => {
    if (a.risk_level !== b.risk_level) return a.risk_level === "critical" ? -1 : 1;
    return a.move_date.localeCompare(b.move_date);
  });

  // Specific reasons per at-risk/critical move (build doc §5.1).
  const reasonsByMove = new Map<string, string[]>();
  if (radar.length > 0) {
    const { data: radarTasks } = await supabase
      .from("tasks")
      .select("relocation_id, title, category, status, due_date, blocked_reason, template_key")
      .in("relocation_id", radar.map((r) => r.id));
    const byMove = new Map<string, any[]>();
    for (const t of radarTasks ?? []) {
      if (!byMove.has(t.relocation_id)) byMove.set(t.relocation_id, []);
      byMove.get(t.relocation_id)!.push(t);
    }
    for (const r of radar) {
      reasonsByMove.set(r.id, riskReasons(byMove.get(r.id) ?? [], r.move_date).slice(0, 2));
    }
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Your Risk Radar and what needs you today."
      />

      <div className="space-y-6 p-6">
        {/* Stat row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Active moves" value={active.length} icon={Boxes} tone="info" />
          <StatCard label="At risk" value={atRisk.length} icon={AlertTriangle} tone="warning" />
          <StatCard label="Critical" value={critical.length} icon={ShieldAlert} tone="danger" />
          <StatCard label="Moving this week" value={thisWeek.length} icon={CalendarClock} tone="brand" />
          <StatCard
            label="My open tasks"
            value={myTasks?.length ?? 0}
            icon={ListTodo}
            tone="neutral"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Risk Radar */}
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning-foreground" />
              <h2 className="text-sm font-semibold">Risk Radar</h2>
              <span className="text-xs text-muted-foreground">
                {radar.length} move{radar.length === 1 ? "" : "s"} need attention
              </span>
            </div>

            {radar.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No moves at risk — nice."
                description="Every active relocation is on track. Enjoy the calm."
              />
            ) : (
              <div className="space-y-2">
                {radar.map((r) => (
                  <Link key={r.id} href={`/moves/${r.id}`} className="block">
                    <Card className="flex-row items-center gap-4 p-4 transition-colors hover:border-brand/40 hover:bg-accent/40">
                      <ProgressRing value={r.progress_pct} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {r.customer?.name ?? "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            → {r.city?.name}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {STAGE_META[r.stage]?.label} · moves {relativeDays(r.move_date)} ·{" "}
                          {formatDate(r.move_date)}
                        </div>
                        {(reasonsByMove.get(r.id) ?? []).length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {(reasonsByMove.get(r.id) ?? []).map((reason, i) => (
                              <li
                                key={i}
                                className={
                                  r.risk_level === "critical"
                                    ? "text-xs font-medium text-danger"
                                    : "text-xs font-medium text-warning-foreground"
                                }
                              >
                                • {reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <StatusChip tone={RISK_META[r.risk_level].tone}>
                        {RISK_META[r.risk_level].label}
                      </StatusChip>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Needs you */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ListTodo className="size-4 text-brand" />
              <h2 className="text-sm font-semibold">Needs you</h2>
            </div>
            {(myTasks?.length ?? 0) === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="No open tasks assigned to you right now."
              />
            ) : (
              <Card className="divide-y p-0">
                {(myTasks ?? []).map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/moves/${t.relocation_id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.relocation?.customer?.name}
                      </div>
                    </div>
                    <span
                      className={
                        isOverdue(t.due_date)
                          ? "text-xs font-medium text-danger"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {relativeDays(t.due_date)}
                    </span>
                  </Link>
                ))}
              </Card>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
