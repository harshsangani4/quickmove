"use client";

import { useState, useTransition } from "react";
import { Compass, LinkIcon, Loader2, CheckCircle2 } from "lucide-react";
import { requestNewLink } from "@/lib/actions/portal";

const COPY: Record<string, { title: string; body: string }> = {
  expired: {
    title: "This link has expired",
    body: "For your security, move links expire after a while. Request a fresh one and your coordinator will send it over.",
  },
  revoked: {
    title: "This link is no longer active",
    body: "This link was turned off. Request a new one and your coordinator will send a fresh link.",
  },
  not_found: {
    title: "We couldn't find this link",
    body: "This link doesn't look right. Please use the most recent link we sent, or request a new one.",
  },
};

export function PortalExpired({
  reason,
  token,
}: {
  reason: "expired" | "revoked" | "not_found";
  token?: string;
}) {
  const copy = COPY[reason] ?? COPY.not_found;
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  // We can only notify ops for a token we can still look up (expired/revoked).
  const canRequest = Boolean(token) && reason !== "not_found";

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-background to-brand-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
          <LinkIcon className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>

        {sent ? (
          <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-success-muted px-4 py-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> Request sent — we&apos;ll be in touch.
          </div>
        ) : (
          <button
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            disabled={!canRequest || pending}
            title={canRequest ? "" : "Please contact your coordinator for a new link."}
            onClick={() =>
              start(async () => {
                if (token) await requestNewLink(token);
                setSent(true);
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Request a new link
          </button>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Compass className="size-3.5" /> QuickMove
        </div>
      </div>
    </div>
  );
}
