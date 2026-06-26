"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { MessagesSquare } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { sendOpsMessage } from "@/lib/actions/moves";

export interface ThreadMessage {
  id: string;
  sender: "ops" | "customer" | "system";
  body: string;
  created_at: string;
}

export function MessageThread({
  relocationId,
  messages,
  readOnly = false,
}: {
  relocationId: string;
  messages: ThreadMessage[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function send() {
    if (!body.trim()) return;
    start(async () => {
      const res = await sendOpsMessage({ relocationId, body: body.trim() });
      if (!res.ok) {
        toast.error("Couldn't send", { description: res.error });
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No messages yet" />
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col",
                m.sender === "ops" && "items-end",
                m.sender === "customer" && "items-start",
                m.sender === "system" && "items-center",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.sender === "ops" && "bg-primary text-primary-foreground",
                  m.sender === "customer" && "bg-muted",
                  m.sender === "system" &&
                    "bg-transparent text-center text-xs text-muted-foreground",
                )}
              >
                {m.body}
              </div>
              {m.sender !== "system" && (
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {m.sender === "ops" ? "You" : "Customer"} ·{" "}
                  {formatDistanceToNow(parseISO(m.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {!readOnly && (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Reply to the customer…"
            rows={2}
            className="min-h-0 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <Button size="icon" onClick={send} disabled={pending || !body.trim()} aria-label="Send message">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
