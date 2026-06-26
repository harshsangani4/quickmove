"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Lock,
  ShieldCheck,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusChip } from "@/components/status-chip";
import {
  CATEGORY_META,
  TASK_STATUS_META,
  PROOF_TYPE_LABEL,
} from "@/lib/constants";
import { lockedByDependencies } from "@/lib/playbook/engine";
import { relativeDays, isOverdue } from "@/lib/format";
import { completeTask, updateTaskStatus } from "@/lib/actions/tasks";
import type { TaskCategory, TaskStatus, ProofType } from "@/lib/types";

export interface ChecklistTask {
  id: string;
  template_key: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  due_date: string | null;
  blocked_reason: string | null;
  requires_proof: boolean;
  proof_type: ProofType | null;
  proof_value: string | null;
  depends_on: string[];
  owner_name: string | null;
}

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const CATEGORY_ORDER: TaskCategory[] = ["apartment", "movers", "utility", "paperwork", "support"];

export function MissionChecklist({
  initialTasks,
  readOnly = false,
}: {
  initialTasks: ChecklistTask[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [proofTask, setProofTask] = useState<ChecklistTask | null>(null);
  const [blockTask, setBlockTask] = useState<ChecklistTask | null>(null);

  const locked = lockedByDependencies(
    tasks.map((t) => ({ template_key: t.template_key, status: t.status, depends_on: t.depends_on })),
  );
  const titleByKey = new Map(tasks.map((t) => [t.template_key, t.title]));

  function patchLocal(taskId: string, patch: Partial<ChecklistTask>) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }

  async function changeStatus(task: ChecklistTask, status: TaskStatus, blockedReason?: string) {
    if (status === "done" && task.requires_proof) {
      setProofTask(task);
      return;
    }
    if (status === "blocked" && !blockedReason) {
      setBlockTask(task);
      return;
    }
    // Optimistic update with rollback (build doc §8).
    const prev = task.status;
    patchLocal(task.id, {
      status,
      blocked_reason: status === "blocked" ? blockedReason ?? null : null,
    });
    const res = await updateTaskStatus({ taskId: task.id, status, blockedReason });
    if (!res.ok) {
      patchLocal(task.id, { status: prev });
      toast.error("Couldn't update", { description: res.error });
      return;
    }
    toast.success(`Marked ${TASK_STATUS_META[status].label.toLowerCase()}`);
    router.refresh();
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: tasks.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="space-y-5">
        {grouped.map(({ cat, items }) => {
          const done = items.filter((t) => t.status === "done").length;
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{CATEGORY_META[cat].label}</h3>
                <span className="text-xs text-muted-foreground">
                  {done}/{items.length} done
                </span>
              </div>
              <Card className="divide-y p-0">
                {items.map((t) => {
                  const lockedBy = locked[t.template_key];
                  const overdue = isOverdue(t.due_date) && t.status !== "done";
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 w-24 shrink-0">
                        {lockedBy?.length ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="size-3.5" /> Locked
                          </span>
                        ) : (
                          <StatusChip tone={TASK_STATUS_META[t.status].tone}>
                            {TASK_STATUS_META[t.status].label}
                          </StatusChip>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{t.title}</span>
                          {t.requires_proof && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <ShieldCheck className="size-3" />
                              {PROOF_TYPE_LABEL[t.proof_type ?? ""] ?? "Proof"}
                            </Badge>
                          )}
                        </div>
                        {lockedBy?.length ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Waiting on: {lockedBy.map((k) => titleByKey.get(k) ?? k).join(", ")}
                          </p>
                        ) : t.status === "blocked" && t.blocked_reason ? (
                          <p className="mt-0.5 text-xs text-danger">Blocked: {t.blocked_reason}</p>
                        ) : t.status === "done" && t.proof_value ? (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="size-3" /> Proof: {t.proof_value}
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className={overdue ? "text-xs font-medium text-danger" : "text-xs text-muted-foreground"}>
                          {relativeDays(t.due_date)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{t.owner_name}</div>
                      </div>

                      {!readOnly && !lockedBy?.length && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1">
                              Status <ChevronDown className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STATUS_OPTIONS.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={s === t.status}
                                onSelect={() => changeStatus(t, s)}
                              >
                                {s === "done" && t.requires_proof ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <ShieldCheck className="size-3.5" /> Mark done (proof)
                                  </span>
                                ) : (
                                  TASK_STATUS_META[s].label
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          );
        })}
      </div>

      <ProofDialog
        task={proofTask}
        onClose={() => setProofTask(null)}
        onDone={(taskId, proofValue) => {
          patchLocal(taskId, { status: "done", proof_value: proofValue });
          setProofTask(null);
          router.refresh();
        }}
      />
      <BlockDialog
        task={blockTask}
        onClose={() => setBlockTask(null)}
        onSubmit={(reason) => {
          if (blockTask) changeStatus(blockTask, "blocked", reason);
          setBlockTask(null);
        }}
      />
    </>
  );
}

function ProofDialog({
  task,
  onClose,
  onDone,
}: {
  task: ChecklistTask | null;
  onClose: () => void;
  onDone: (taskId: string, proofValue: string) => void;
}) {
  const [pending, start] = useTransition();
  const isFile = task?.proof_type === "photo" || task?.proof_type === "doc";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("taskId", task.id);
    const display = isFile
      ? (fd.get("file") as File)?.name ?? "file"
      : String(fd.get("proofValue") ?? "");
    start(async () => {
      const res = await completeTask(fd);
      if (!res.ok) {
        toast.error("Couldn't complete task", { description: res.error });
        return;
      }
      toast.success("Task completed", { description: "Proof recorded and audit-logged." });
      onDone(task.id, display);
    });
  }

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete with proof</DialogTitle>
          <DialogDescription>
            {task?.title} requires{" "}
            <span className="font-medium text-foreground">
              {PROOF_TYPE_LABEL[task?.proof_type ?? ""] ?? "proof"}
            </span>{" "}
            before it can be closed. This is recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {task?.proof_type === "account_no" && (
            <div className="space-y-2">
              <Label htmlFor="proofValue">Account / reference number</Label>
              <Input id="proofValue" name="proofValue" required placeholder="e.g. ACC-482910" />
            </div>
          )}
          {task?.proof_type === "confirmation" && (
            <div className="space-y-2">
              <Label htmlFor="proofValue">Confirmation note</Label>
              <Input id="proofValue" name="proofValue" required placeholder="e.g. Confirmed by vendor on call" />
            </div>
          )}
          {isFile && (
            <div className="space-y-2">
              <Label htmlFor="file" className="flex items-center gap-1.5">
                <Paperclip className="size-3.5" />
                Upload {task?.proof_type === "photo" ? "photo" : "document"} (PDF/JPG/PNG, max 8 MB)
              </Label>
              <Input
                id="file"
                name="file"
                type="file"
                required
                accept={task?.proof_type === "photo" ? "image/png,image/jpeg" : "application/pdf,image/png,image/jpeg"}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Complete task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({
  task,
  onClose,
  onSubmit,
}: {
  task: ChecklistTask | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block this task</DialogTitle>
          <DialogDescription>
            Add a clear reason — it shows on the move and feeds escalation.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Vendor hasn't confirmed the truck for move day."
          rows={3}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => {
              onSubmit(reason.trim());
              setReason("");
            }}
          >
            Block task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
