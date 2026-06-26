"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, MapPin, Clock, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { approveApartment, rejectApartment } from "@/lib/actions/portal";

interface Apt {
  id: string;
  title: string;
  rent: number | null;
  bedrooms: number | null;
  locality: string | null;
  commute_min: number | null;
  status: string;
}

export function ApartmentDecision({ token, apartments }: { token: string; apartments: Apt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const decided = apartments.some((a) => a.status === "approved");

  function approve(id: string) {
    start(async () => {
      const res = await approveApartment(token, id);
      if (!res.ok) { toast.error("Couldn't approve", { description: res.error }); return; }
      toast.success("Approved — great choice!");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {apartments.map((a) => {
        const isApproved = a.status === "approved";
        const isRejected = a.status === "rejected";
        return (
          <div
            key={a.id}
            className={`overflow-hidden rounded-2xl border bg-card ${isApproved ? "border-success/50" : isRejected ? "opacity-60" : ""}`}
          >
            <div className="flex h-32 items-center justify-center bg-gradient-to-br from-brand-muted/40 to-muted text-muted-foreground">
              <span className="text-sm">Photo coming soon</span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{a.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {a.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="size-3.5" /> {a.bedrooms} BHK</span>}
                    {a.locality && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {a.locality}</span>}
                    {a.commute_min != null && <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {a.commute_min} min commute</span>}
                  </div>
                </div>
                {a.rent != null && <div className="text-right"><div className="font-semibold tabular-nums">{formatINR(a.rent)}</div><div className="text-[10px] text-muted-foreground">/month</div></div>}
              </div>

              {isApproved ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-success-muted px-3 py-1.5 text-sm font-medium text-success">
                  <Check className="size-4" /> You approved this home
                </div>
              ) : isRejected ? (
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <X className="size-4" /> Not chosen
                </div>
              ) : !decided ? (
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" disabled={pending} onClick={() => approve(a.id)}>
                    {pending && <Loader2 className="size-4 animate-spin" />} Approve this home
                  </Button>
                  <Button variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
                    Ask for other options
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <Dialog open={rejecting} onOpenChange={(o) => !o && setRejecting(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request other options</DialogTitle>
            <DialogDescription>Tell your coordinator what you&apos;d prefer — we&apos;ll curate more.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Closer to the office, budget under ₹35k…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const first = apartments.find((a) => a.status === "shortlisted");
                  const res = await rejectApartment(token, first?.id ?? "", note);
                  if (!res.ok) { toast.error("Couldn't send", { description: res.error }); return; }
                  toast.success("Sent — we'll find better options.");
                  setRejecting(false);
                  setNote("");
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
