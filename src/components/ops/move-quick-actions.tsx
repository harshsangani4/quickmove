"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquare,
  CalendarClock,
  PauseCircle,
  PlayCircle,
  XCircle,
  RotateCcw,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatShortDate } from "@/lib/format";
import {
  applyReflow,
  previewReflow,
  setHold,
  cancelMove,
  restoreMove,
  sendOpsMessage,
  type ReflowChange,
} from "@/lib/actions/moves";

export function MoveQuickActions({
  relocationId,
  status,
  moveDate,
  customerName,
  isAdmin,
}: {
  relocationId: string;
  status: string;
  moveDate: string;
  customerName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openMsg, setOpenMsg] = useState(false);
  const [openReflow, setOpenReflow] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);

  const closed = status === "cancelled" || status === "completed";

  function toggleHold() {
    start(async () => {
      const res = await setHold({ relocationId, hold: status !== "on_hold" });
      if (!res.ok) {
        toast.error("Couldn't update", { description: res.error });
        return;
      }
      toast.success(status !== "on_hold" ? "Move put on hold" : "Move resumed");
      router.refresh();
    });
  }

  if (status === "cancelled") {
    return isAdmin ? (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await restoreMove(relocationId);
            if (!res.ok) {
              toast.error("Couldn't restore", { description: res.error });
              return;
            }
            toast.success("Move restored");
            router.refresh();
          })
        }
      >
        <RotateCcw className="size-4" /> Restore move
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">Cancelled · read-only</span>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpenMsg(true)}>
          <MessageSquare className="size-4" /> Message
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpenReflow(true)} disabled={closed}>
          <CalendarClock className="size-4" /> Reflow
        </Button>
        <Button variant="outline" size="sm" onClick={toggleHold} disabled={pending || closed}>
          {status === "on_hold" ? (
            <>
              <PlayCircle className="size-4" /> Resume
            </>
          ) : (
            <>
              <PauseCircle className="size-4" /> Hold
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger"
          onClick={() => setOpenCancel(true)}
          disabled={closed}
        >
          <XCircle className="size-4" /> Cancel
        </Button>
      </div>

      <MessageDialog
        open={openMsg}
        onClose={() => setOpenMsg(false)}
        relocationId={relocationId}
        customerName={customerName}
      />
      <ReflowDialog
        open={openReflow}
        onClose={() => setOpenReflow(false)}
        relocationId={relocationId}
        moveDate={moveDate}
      />
      <CancelDialog
        open={openCancel}
        onClose={() => setOpenCancel(false)}
        relocationId={relocationId}
      />
    </>
  );
}

function MessageDialog({
  open,
  onClose,
  relocationId,
  customerName,
}: {
  open: boolean;
  onClose: () => void;
  relocationId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {customerName}</DialogTitle>
          <DialogDescription>This appears in their portal message thread.</DialogDescription>
        </DialogHeader>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Type your update…" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!body.trim() || pending}
            onClick={() =>
              start(async () => {
                const res = await sendOpsMessage({ relocationId, body: body.trim() });
                if (!res.ok) {
                  toast.error("Couldn't send", { description: res.error });
                  return;
                }
                toast.success("Message sent");
                setBody("");
                onClose();
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReflowDialog({
  open,
  onClose,
  relocationId,
  moveDate,
}: {
  open: boolean;
  onClose: () => void;
  relocationId: string;
  moveDate: string;
}) {
  const router = useRouter();
  const [newDate, setNewDate] = useState(moveDate);
  const [changes, setChanges] = useState<ReflowChange[] | null>(null);
  const [pending, start] = useTransition();
  const [applying, startApply] = useTransition();

  function preview() {
    start(async () => {
      const res = await previewReflow(relocationId, newDate);
      if (!res.ok) {
        setChanges(null);
        toast.error("Can't preview", { description: res.error });
        return;
      }
      setChanges(res.data!.changes);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), setChanges(null))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reflow timeline</DialogTitle>
          <DialogDescription>
            Pick a new move date. We&apos;ll recompute every not-done task&apos;s due date and
            show you the changes before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="newDate">New move date</Label>
            <Input
              id="newDate"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setChanges(null);
              }}
            />
          </div>
          <Button variant="outline" onClick={preview} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Preview changes
          </Button>
        </div>

        {changes && (
          <div className="max-h-56 overflow-auto rounded-lg border">
            {changes.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No due dates change for this date.</p>
            ) : (
              <ul className="divide-y text-sm">
                {changes.map((c) => (
                  <li key={c.taskId} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate">{c.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {formatShortDate(c.oldDue)} <ArrowRight className="size-3" />{" "}
                      <span className="font-medium text-foreground">{formatShortDate(c.newDue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => (onClose(), setChanges(null))}>
            Cancel
          </Button>
          <Button
            disabled={!changes || applying || newDate === moveDate}
            onClick={() =>
              startApply(async () => {
                const res = await applyReflow(relocationId, newDate);
                if (!res.ok) {
                  toast.error("Couldn't reflow", { description: res.error });
                  return;
                }
                toast.success("Timeline reflowed", {
                  description: `${changes?.length ?? 0} task date(s) updated.`,
                });
                setChanges(null);
                onClose();
                router.refresh();
              })
            }
          >
            {applying && <Loader2 className="size-4 animate-spin" />}
            Confirm reflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onClose,
  relocationId,
}: {
  open: boolean;
  onClose: () => void;
  relocationId: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), setConfirmText(""))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this move?</DialogTitle>
          <DialogDescription>
            This makes the move read-only and is audit-logged. A lead or admin can restore it
            later. Type <span className="font-semibold text-foreground">CANCEL</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="CANCEL"
          aria-label="Type CANCEL to confirm"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => (onClose(), setConfirmText(""))}>
            Keep move
          </Button>
          <Button
            variant="destructive"
            disabled={confirmText !== "CANCEL" || pending}
            onClick={() =>
              start(async () => {
                const res = await cancelMove(relocationId);
                if (!res.ok) {
                  toast.error("Couldn't cancel", { description: res.error });
                  return;
                }
                toast.success("Move cancelled");
                setConfirmText("");
                onClose();
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Cancel move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
