import { Compass, LinkIcon } from "lucide-react";

const COPY: Record<string, { title: string; body: string }> = {
  expired: {
    title: "This link has expired",
    body: "For your security, move links expire after a while. Request a fresh one and we'll send it right over.",
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

export function PortalExpired({ reason }: { reason: "expired" | "revoked" | "not_found" }) {
  const copy = COPY[reason] ?? COPY.not_found;
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-background to-brand-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
          <LinkIcon className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
        {/* Request-a-new-link is wired to notify ops in Phase 5. */}
        <button
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          disabled
          title="Available in the next build phase"
        >
          Request a new link
        </button>
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Compass className="size-3.5" /> QuickMove
        </div>
      </div>
    </div>
  );
}
