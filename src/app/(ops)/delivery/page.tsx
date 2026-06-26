import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { DeliveryControls, RetryButton } from "@/components/ops/delivery-controls";
import { CheckCircle2, MailWarning } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { StatusTone } from "@/lib/constants";

const TONE: Record<string, StatusTone> = { queued: "info", sent: "success", failed: "warning", dead: "danger" };

export default async function DeliveryPage() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "lead") redirect("/dashboard");
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("comms_queue")
    .select("id, channel, template_key, status, attempts, last_error, next_attempt_at, created_at, relocation:relocations(customer:customers(name))")
    .order("created_at", { ascending: false });

  const all = (items ?? []) as any[];
  const problems = all.filter((i) => i.status === "dead" || i.status === "failed");
  const healthy = all.filter((i) => i.status === "sent" || i.status === "queued");

  return (
    <>
      <PageHeader title="Delivery issues" description="Notifications that failed delivery never disappear silently — they land here.">
        <DeliveryControls />
      </PageHeader>

      <div className="space-y-6 p-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <MailWarning className="size-4 text-danger" />
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <span className="text-xs text-muted-foreground">{problems.length} item{problems.length === 1 ? "" : "s"}</span>
          </div>
          {problems.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No delivery issues" description="Every notification has been delivered or is on its way." />
          ) : (
            <Card className="divide-y p-0">
              {problems.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{i.template_key}</span>
                      <StatusChip tone={TONE[i.status]} dot={false}>{i.status}</StatusChip>
                      <span className="text-xs text-muted-foreground">{i.channel}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {i.relocation?.customer?.name} · {i.attempts} attempt{i.attempts === 1 ? "" : "s"}
                      {i.last_error ? ` · ${i.last_error}` : ""}
                    </div>
                  </div>
                  <RetryButton id={i.id} />
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Recent deliveries</h2>
          {healthy.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing queued or sent yet.</p>
          ) : (
            <Card className="divide-y p-0">
              {healthy.slice(0, 20).map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <StatusChip tone={TONE[i.status]} dot={false}>{i.status}</StatusChip>
                  <span className="flex-1 truncate">{i.template_key} · {i.relocation?.customer?.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(i.created_at), { addSuffix: true })}</span>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
