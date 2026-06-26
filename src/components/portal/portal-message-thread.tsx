"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, parseISO } from "date-fns";
import { sendCustomerMessage } from "@/lib/actions/portal";

interface Msg { id: string; sender: "ops" | "customer" | "system"; body: string; created_at: string }

export function PortalMessageThread({ token, messages }: { token: string; messages: Msg[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  function send() {
    if (!body.trim()) return;
    start(async () => {
      const res = await sendCustomerMessage(token, body.trim());
      if (!res.ok) { toast.error("Couldn't send", { description: res.error }); return; }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border bg-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Say hello — your coordinator is here to help.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col", m.sender === "customer" ? "items-end" : m.sender === "system" ? "items-center" : "items-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                m.sender === "customer" && "bg-brand text-brand-foreground",
                m.sender === "ops" && "bg-muted",
                m.sender === "system" && "bg-transparent text-center text-xs text-muted-foreground",
              )}>
                {m.body}
              </div>
              {m.sender !== "system" && (
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {m.sender === "customer" ? "You" : "Coordinator"} · {formatDistanceToNow(parseISO(m.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          rows={1}
          className="min-h-10 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button size="icon" onClick={send} disabled={pending || !body.trim()} aria-label="Send">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
