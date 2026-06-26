"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback, raiseIssue } from "@/lib/actions/portal";
import type { LocalService } from "@/lib/portal/local-services";

export function SettleIn({
  token,
  services,
  cityName,
}: {
  token: string;
  services: LocalService[];
  cityName: string;
}) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [issue, setIssue] = useState("");
  const [pending, start] = useTransition();
  const [issuePending, startIssue] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-brand-muted/40 to-card p-5">
        <div className="flex items-center gap-2">
          <PartyPopper className="size-5 text-brand" />
          <h2 className="font-display text-xl font-semibold">Welcome to {cityName}!</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re all moved in. Here are a few things to help you settle in.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.category + s.name} className="rounded-2xl border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-brand">{s.category}</div>
            <div className="mt-1 font-medium">{s.name}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </div>

      {/* NPS / feedback */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-medium">How was your move?</h3>
        {done ? (
          <p className="mt-2 text-sm text-success">Thank you — your feedback helps us improve. 💚</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  className={`size-9 rounded-lg border text-sm font-medium transition ${score === i ? "border-brand bg-brand text-brand-foreground" : "hover:border-brand/50"}`}
                  aria-label={`Rate ${i} out of 10`}
                >
                  {i}
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything you'd like to share? (optional)"
              rows={2}
              className="mt-3"
            />
            <Button
              className="mt-3"
              disabled={score === null || pending}
              onClick={() =>
                start(async () => {
                  const res = await submitFeedback(token, score ?? 0, comment);
                  if (!res.ok) {
                    toast.error("Couldn't submit", { description: res.error });
                    return;
                  }
                  setDone(true);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Submit feedback
            </Button>
          </>
        )}
      </div>

      {/* Raise an issue */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-medium">Something not right?</h3>
        <p className="text-sm text-muted-foreground">Raise an issue and your coordinator will pick it up.</p>
        <Textarea value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe the issue…" rows={2} className="mt-3" />
        <Button
          variant="outline"
          className="mt-3"
          disabled={!issue.trim() || issuePending}
          onClick={() =>
            startIssue(async () => {
              const res = await raiseIssue(token, issue.trim());
              if (!res.ok) {
                toast.error("Couldn't raise issue", { description: res.error });
                return;
              }
              toast.success("Issue raised — we're on it.");
              setIssue("");
              router.refresh();
            })
          }
        >
          {issuePending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Raise issue
        </Button>
      </div>
    </section>
  );
}
