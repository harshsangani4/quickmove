import Link from "next/link";
import { verifyToken } from "@/lib/portal/token";
import {
  getPortalSummary,
  getActionItems,
  getStatusBoard,
  getMoveDayStatus,
} from "@/lib/portal/data";
import { getLocalServices } from "@/lib/portal/local-services";
import { CUSTOMER_TIMELINE, STAGE_ORDER } from "@/lib/constants";
import { relativeDays, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SettleIn } from "@/components/portal/settle-in";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  Truck,
  Zap,
  Wifi,
  Flame,
  Droplet,
  Landmark,
  IdCard,
  Repeat,
  ShieldCheck,
} from "lucide-react";

const UTIL_ICON: Record<string, any> = { Electricity: Zap, Internet: Wifi, Gas: Flame, Water: Droplet };
const PAPER_ICON: Record<string, any> = {
  "Bank address": Landmark,
  "ID / Aadhaar": IdCard,
  Subscriptions: Repeat,
  "Police verification": ShieldCheck,
};

function statusTone(status: string) {
  switch (status) {
    case "done": return { label: "Done", cls: "text-success bg-success-muted" };
    case "in_progress": return { label: "In progress", cls: "text-info bg-info-muted" };
    case "blocked": return { label: "Needs attention", cls: "text-danger bg-danger-muted" };
    default: return { label: "Pending", cls: "text-muted-foreground bg-muted" };
  }
}

export default async function PortalHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyToken(token);
  if (!result.ok) return null; // layout already handles invalid links
  const relocationId = result.relocationId;

  const [summary, actions, board, moveDay] = await Promise.all([
    getPortalSummary(relocationId),
    getActionItems(relocationId, token),
    getStatusBoard(relocationId),
    getMoveDayStatus(relocationId),
  ]);

  const currentStageIdx = STAGE_ORDER.indexOf(summary.stage);
  const daysToMove = Math.round(
    (new Date(summary.move_date).getTime() - Date.now()) / 86_400_000,
  );
  const delivered = summary.stage === "done" || summary.status === "completed" || moveDay.current >= 5;
  const showMoveDay = daysToMove <= 1 || moveDay.current > 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <p className="text-sm text-muted-foreground">
          Hello {summary.customer?.name?.split(" ")[0]}, here&apos;s where things stand.
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your move to {summary.city?.name} is {summary.progress_pct}% done
        </h1>
        <p className="mt-2 text-muted-foreground">
          {daysToMove > 0
            ? `Moving day is ${relativeDays(summary.move_date)} — ${formatDate(summary.move_date)}.`
            : daysToMove === 0
              ? "Today is moving day! 🎉"
              : `You moved on ${formatDate(summary.move_date)}.`}
        </p>
        <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${summary.progress_pct}%` }} />
        </div>

        {/* Stage timeline */}
        <ol className="mt-6 space-y-1">
          {CUSTOMER_TIMELINE.map((step) => {
            const idx = STAGE_ORDER.indexOf(step.stage);
            const done = idx < currentStageIdx || summary.stage === "done";
            const current = idx === currentStageIdx && summary.stage !== "done";
            return (
              <li key={step.stage} className="flex items-center gap-3 py-1.5">
                {done ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : current ? (
                  <span className="flex size-5 items-center justify-center">
                    <span className="size-3 animate-pulse rounded-full bg-brand" />
                  </span>
                ) : (
                  <Circle className="size-5 text-muted-foreground/40" />
                )}
                <span className={cn("text-sm", current && "font-semibold text-brand", !done && !current && "text-muted-foreground")}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Action Center */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-brand" />
          <h2 className="font-semibold">What we need from you</h2>
        </div>
        {actions.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-success" />
            <p className="font-medium">You&apos;re all caught up</p>
            <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <Link key={a.id} href={a.href}>
                <div className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-brand/40", a.urgent && "border-danger/40 bg-danger-muted/30")}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm text-muted-foreground">{a.description}</div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Move-day live tracker */}
      {showMoveDay && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Truck className="size-4 text-brand" />
            <h2 className="font-semibold">Move day</h2>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            {moveDay.current === 0 && daysToMove > 0 ? (
              <p className="text-sm text-muted-foreground">
                We&apos;ll go live here on the day — scheduled for {formatDate(summary.move_date)}.
              </p>
            ) : (
              <ol className="space-y-3">
                {moveDay.steps.map((step, i) => {
                  const done = i < moveDay.current;
                  const active = i === moveDay.current;
                  return (
                    <li key={step} className="flex items-center gap-3">
                      <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", done ? "bg-success text-success-foreground" : active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={cn("text-sm", active && "font-semibold text-brand", !done && !active && "text-muted-foreground")}>
                        {step}
                        {active && <span className="ml-2 inline-block animate-pulse text-brand">●</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* Status board */}
      <section>
        <h2 className="mb-3 font-semibold">Utilities & address changes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...board.utilities.map((u) => ({ ...u, icon: UTIL_ICON[u.label] })),
            ...board.paperwork.map((p) => ({ ...p, icon: PAPER_ICON[p.label] }))].map((row) => {
            const tone = statusTone(row.status);
            const Icon = row.icon ?? Circle;
            return (
              <div key={row.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{row.label}</div>
                  {row.reference && row.status === "done" ? (
                    <div className="truncate text-xs text-muted-foreground">Ref: {row.reference}</div>
                  ) : null}
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone.cls)}>{tone.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Settle-in (after delivery) */}
      {delivered && (
        <SettleIn token={token} services={getLocalServices(summary.city?.slug ?? "")} cityName={summary.city?.name ?? ""} />
      )}
    </div>
  );
}
