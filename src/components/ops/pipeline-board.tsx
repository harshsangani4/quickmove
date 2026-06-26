"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  ChevronDown,
  ChevronRight,
  GripVertical,
  AlertTriangle,
  MoveRight,
  X,
} from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusChip } from "@/components/status-chip";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/empty-state";
import { STAGE_ORDER, STAGE_META, RISK_META } from "@/lib/constants";
import { relativeDays } from "@/lib/format";
import { setStage } from "@/lib/actions/moves";
import type { Stage, RiskLevel } from "@/lib/types";

export interface BoardMove {
  id: string;
  customerName: string;
  citySlug: string;
  cityName: string;
  ownerId: string | null;
  ownerName: string | null;
  moveDate: string;
  stage: Stage;
  status: string;
  riskLevel: RiskLevel;
  progressPct: number;
  blocker: string | null;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function moveWeekBucket(moveDate: string): "past" | "this" | "next" | "later" {
  const d = differenceInCalendarDays(parseISO(moveDate), new Date());
  if (d < 0) return "past";
  if (d <= 7) return "this";
  if (d <= 14) return "next";
  return "later";
}

export function PipelineBoard({ moves: initialMoves }: { moves: BoardMove[] }) {
  const router = useRouter();
  const [moves, setMoves] = useState(initialMoves);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [owner, setOwner] = useState("all");
  const [risk, setRisk] = useState("all");
  const [week, setWeek] = useState("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const cities = useMemo(() => {
    const map = new Map<string, string>();
    moves.forEach((m) => map.set(m.citySlug, m.cityName));
    return [...map.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [moves]);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    moves.forEach((m) => m.ownerId && map.set(m.ownerId, m.ownerName ?? "Unknown"));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [moves]);

  const filtered = useMemo(() => {
    return moves.filter((m) => {
      if (search && !m.customerName.toLowerCase().includes(search.toLowerCase())) return false;
      if (city !== "all" && m.citySlug !== city) return false;
      if (owner !== "all" && m.ownerId !== owner) return false;
      if (risk !== "all" && m.riskLevel !== risk) return false;
      if (week !== "all" && moveWeekBucket(m.moveDate) !== week) return false;
      return true;
    });
  }, [moves, search, city, owner, risk, week]);

  const lanes = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; items: BoardMove[] }>();
    for (const m of filtered) {
      if (!map.has(m.citySlug)) map.set(m.citySlug, { slug: m.citySlug, name: m.cityName, items: [] });
      map.get(m.citySlug)!.items.push(m);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const hasFilters = search || city !== "all" || owner !== "all" || risk !== "all" || week !== "all";

  async function changeStage(moveId: string, newStage: Stage) {
    const move = moves.find((m) => m.id === moveId);
    if (!move || move.stage === newStage) return;
    const prev = move.stage;
    setMoves((ms) => ms.map((m) => (m.id === moveId ? { ...m, stage: newStage } : m)));
    const res = await setStage({ relocationId: moveId, stage: newStage });
    if (!res.ok) {
      setMoves((ms) => ms.map((m) => (m.id === moveId ? { ...m, stage: prev } : m)));
      toast.error("Couldn't move card", { description: res.error });
      return;
    }
    toast.success(`Moved to ${STAGE_META[newStage].label}`);
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card/40 px-6 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer…"
            className="h-9 w-52 pl-8"
          />
        </div>
        <FilterSelect value={city} onChange={setCity} placeholder="City" options={[{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c.slug, label: c.name }))]} />
        <FilterSelect value={owner} onChange={setOwner} placeholder="Owner" options={[{ value: "all", label: "All owners" }, ...owners.map((o) => ({ value: o.id, label: o.name }))]} />
        <FilterSelect value={risk} onChange={setRisk} placeholder="Risk" options={[{ value: "all", label: "All risk" }, { value: "critical", label: "Critical" }, { value: "at_risk", label: "At risk" }, { value: "on_track", label: "On track" }]} />
        <FilterSelect value={week} onChange={setWeek} placeholder="Move week" options={[{ value: "all", label: "Any time" }, { value: "this", label: "This week" }, { value: "next", label: "Next week" }, { value: "later", label: "Later" }, { value: "past", label: "Past" }]} />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCity("all"); setOwner("all"); setRisk("all"); setWeek("all"); }}>
            <X className="size-3.5" /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {moves.length} moves
        </span>
      </div>

      {/* Lanes */}
      <div className="flex-1 overflow-auto p-4">
        {lanes.length === 0 ? (
          <EmptyState className="mt-10" icon={Search} title="No moves match your filters" description="Try clearing a filter or two." />
        ) : (
          <div className="space-y-4">
            {lanes.map((lane) => {
              const isCollapsed = collapsed[lane.slug];
              return (
                <div key={lane.slug} className="rounded-xl border bg-card/30">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [lane.slug]: !c[lane.slug] }))}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                  >
                    {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                    <span className="font-semibold">{lane.name}</span>
                    <span className="text-xs text-muted-foreground">{lane.items.length} moves</span>
                  </button>

                  {!isCollapsed && (
                    <div className="flex gap-3 overflow-x-auto px-3 pb-3">
                      {STAGE_ORDER.map((stage) => {
                        const items = lane.items.filter((m) => m.stage === stage);
                        const isOver = dragOver === `${lane.slug}:${stage}`;
                        return (
                          <div
                            key={stage}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOver(`${lane.slug}:${stage}`);
                            }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={() => {
                              setDragOver(null);
                              if (dragId) changeStage(dragId, stage);
                              setDragId(null);
                            }}
                            className={cn(
                              "flex w-60 shrink-0 flex-col rounded-lg border bg-background/60 transition-colors",
                              isOver && "border-brand bg-brand-muted/40",
                            )}
                          >
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {STAGE_META[stage].label}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{items.length}</span>
                            </div>
                            <div className="flex min-h-16 flex-col gap-2 p-2 pt-0">
                              {items.map((m) => (
                                <MoveCard
                                  key={m.id}
                                  move={m}
                                  onDragStart={() => setDragId(m.id)}
                                  onChangeStage={(s) => changeStage(m.id, s)}
                                />
                              ))}
                              {items.length === 0 && (
                                <div className="rounded-md border border-dashed py-3 text-center text-[11px] text-muted-foreground/60">
                                  Drop here
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-32" size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MoveCard({
  move,
  onDragStart,
  onChangeStage,
}: {
  move: BoardMove;
  onDragStart: () => void;
  onChangeStage: (s: Stage) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />
        <Link href={`/moves/${move.id}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium hover:text-brand">{move.customerName}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            moves {relativeDays(move.moveDate)}
          </div>
        </Link>
        <ProgressRing value={move.progressPct} size={30} stroke={3} />
      </div>

      {move.blocker && (
        <div className="mt-2 flex items-start gap-1 rounded-md bg-danger-muted/60 px-2 py-1 text-[11px] text-danger">
          <AlertTriangle className="mt-px size-3 shrink-0" />
          <span className="line-clamp-1">{move.blocker}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusChip tone={RISK_META[move.riskLevel].tone} className="text-[10px]">
          {RISK_META[move.riskLevel].label}
        </StatusChip>
        <div className="flex items-center gap-1">
          {move.ownerName && (
            <Avatar className="size-6">
              <AvatarFallback className="bg-muted text-[9px]">{initials(move.ownerName)}</AvatarFallback>
            </Avatar>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6" aria-label="Move to stage">
                <MoveRight className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
              {STAGE_ORDER.map((s) => (
                <DropdownMenuItem key={s} disabled={s === move.stage} onSelect={() => onChangeStage(s)}>
                  {STAGE_META[s].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
