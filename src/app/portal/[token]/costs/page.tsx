import { verifyToken } from "@/lib/portal/token";
import { getPayments } from "@/lib/portal/data";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Download, Wallet } from "lucide-react";

export default async function PortalCostsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyToken(token);
  if (!result.ok) return null;
  const payments = await getPayments(result.relocationId);

  const totalDue = payments.filter((p: any) => p.status === "due").reduce((s: number, p: any) => s + p.amount, 0);
  const totalPaid = payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Costs & payments</h1>
        <p className="text-sm text-muted-foreground">Full transparency — what&apos;s paid, what&apos;s due, and when.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Paid so far</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-success">{formatINR(totalPaid)}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Still due</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-warning-foreground">{formatINR(totalDue)}</div>
        </div>
      </div>

      <div className="space-y-2">
        {payments.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
            <div className={cn("flex size-9 items-center justify-center rounded-xl", p.status === "paid" ? "bg-success-muted text-success" : "bg-warning-muted text-warning-foreground")}>
              {p.status === "paid" ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.label}</div>
              <div className="text-xs text-muted-foreground">
                {p.status === "paid" ? "Paid" : `Due ${formatDate(p.due_date)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums">{formatINR(p.amount)}</div>
              <div className="flex items-center gap-2">
                <button className="text-[11px] text-muted-foreground hover:text-foreground" title="Mock invoice">
                  <Download className="inline size-3" /> Invoice
                </button>
              </div>
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No payments yet.</p>
        )}
      </div>

      {totalDue > 0 && (
        <div className="rounded-2xl border bg-card p-4 text-center">
          <Wallet className="mx-auto mb-1.5 size-5 text-brand" />
          <p className="text-sm text-muted-foreground">
            To pay your balance, reach out to your coordinator in Messages — they&apos;ll share secure payment options.
          </p>
        </div>
      )}
    </div>
  );
}
