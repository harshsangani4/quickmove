"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Copy, Wand2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { askCopilot } from "@/lib/actions/copilot";

interface Turn { q: string; answer: string; draft: string | null; degraded: boolean }

const SUGGESTIONS = [
  "Which moves this week are at risk and why?",
  "What's blocking this move?",
  "Draft a WhatsApp update for the customer",
];

export function CopilotChat({
  moves,
  aiEnabled,
}: {
  moves: { id: string; label: string }[];
  aiEnabled: boolean;
}) {
  const [moveId, setMoveId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, start] = useTransition();

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    start(async () => {
      const res = await askCopilot(text, moveId === "all" ? undefined : moveId);
      if (!res.ok) { toast.error("Copilot error", { description: res.error }); return; }
      setTurns((t) => [...t, { q: text, answer: res.answer, draft: res.draft, degraded: res.degraded }]);
      setQ("");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={moveId} onValueChange={setMoveId}>
          <SelectTrigger className="w-64" size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All my moves</SelectItem>
            {moves.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {!aiEnabled && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-medium text-warning-foreground">
            <Info className="size-3" /> AI offline — showing computed answers
          </span>
        )}
      </div>

      {turns.length === 0 && (
        <Card className="gap-3 p-6 text-center">
          <Sparkles className="mx-auto size-7 text-brand" />
          <p className="font-medium">Ask the copilot</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border px-3 py-1.5 text-xs transition hover:border-brand hover:text-brand">
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{t.q}</div>
            </div>
            <Card className="gap-3 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
                <p className="whitespace-pre-wrap text-sm">{t.answer}</p>
              </div>
              {t.draft && (
                <div className="rounded-xl border bg-muted/50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Wand2 className="size-3" /> Draft message</span>
                    <Button
                      variant="ghost" size="sm" className="h-7"
                      onClick={() => { navigator.clipboard.writeText(t.draft!); toast.success("Draft copied"); }}
                    >
                      <Copy className="size-3.5" /> Copy
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{t.draft}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Review before sending — the copilot never sends messages itself.</p>
                </div>
              )}
              {t.degraded && aiEnabled && (
                <p className="text-[11px] text-warning-foreground">AI was unavailable — this is a computed answer.</p>
              )}
            </Card>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about a move, or ask for a draft…"
          rows={2}
          className="resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(q); }}
        />
        <Button onClick={() => ask(q)} disabled={pending || !q.trim()} aria-label="Ask">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
