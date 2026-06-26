"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, RefreshCw, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryCommsItem } from "@/lib/actions/comms";

export function DeliveryControls() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run(url: string, label: string) {
    setRunning(true);
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "failed");
      toast.success(`${label} done`, { description: JSON.stringify(json) });
      router.refresh();
    } catch (e: any) {
      toast.error(`${label} failed`, { description: e.message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={running} onClick={() => run("/api/comms/worker", "Worker run")}>
        {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run worker
      </Button>
      <Button size="sm" variant="outline" disabled={running} onClick={() => run("/api/escalations/run", "Escalation scan")}>
        <ShieldAlert className="size-4" /> Run escalation scan
      </Button>
    </div>
  );
}

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await retryCommsItem(id);
          if (!res.ok) { toast.error("Couldn't retry", { description: res.error }); return; }
          toast.success("Requeued for delivery");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Retry
    </Button>
  );
}
