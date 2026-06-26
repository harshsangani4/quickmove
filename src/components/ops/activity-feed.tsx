import { formatDistanceToNow, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/empty-state";
import { History } from "lucide-react";

export interface ActivityRow {
  id: string;
  actor_type: "ops" | "customer" | "system";
  action: string;
  entity: string | null;
  created_at: string;
  actor_name?: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  "relocation.created": "created this move",
  "relocation.reflowed": "reflowed the timeline",
  "relocation.on_hold": "put the move on hold",
  "relocation.resumed": "resumed the move",
  "relocation.cancelled": "cancelled the move",
  "relocation.restored": "restored the move",
  "task.completed": "completed a task",
  "task.status_changed": "changed a task status",
  "message.sent": "messaged the customer",
  "document.uploaded": "uploaded a document",
  "apartment.decided": "recorded an apartment decision",
};

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={History} title="No activity yet" />;
  }
  return (
    <ScrollArea className="h-72 pr-3">
      <ol className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex gap-3 text-sm">
            <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <div className="min-w-0">
              <p className="leading-snug">
                <span className="font-medium">{r.actor_name ?? actorFallback(r.actor_type)}</span>{" "}
                <span className="text-muted-foreground">
                  {ACTION_LABEL[r.action] ?? r.action}
                  {r.entity ? ` · ${r.entity}` : ""}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

function actorFallback(type: string) {
  if (type === "system") return "System";
  if (type === "customer") return "Customer";
  return "Ops";
}
