"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusChip } from "@/components/status-chip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createOpsUser, setUserActive } from "@/lib/actions/users";

interface Usr { id: string; name: string; email: string; role: string; city_ids: string[]; active: boolean }
interface City { id: string; name: string }

function initials(n: string) {
  return n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
}
const ROLE_TONE: Record<string, "brand" | "info" | "neutral"> = { admin: "brand", lead: "info", ops: "neutral" };

export function TeamManager({
  currentUserId,
  users,
  cities,
}: {
  currentUserId: string;
  users: Usr[];
  cities: City[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? "—";

  function toggle(u: Usr) {
    start(async () => {
      const res = await setUserActive(u.id, !u.active);
      if (!res.ok) { toast.error("Couldn't update", { description: res.error }); return; }
      toast.success(u.active ? "User deactivated" : "User activated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}><UserPlus className="size-4" /> Add team member</Button>
      </div>

      <Card className="divide-y p-0">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar className="size-9"><AvatarFallback className="bg-muted text-xs">{initials(u.name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{u.name}</span>
                <StatusChip tone={ROLE_TONE[u.role] ?? "neutral"} dot={false}>{u.role}</StatusChip>
                {!u.active && <StatusChip tone="danger" dot={false}>inactive</StatusChip>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {u.email}
                {u.role === "ops" && u.city_ids.length > 0 && <> · {u.city_ids.map(cityName).join(", ")}</>}
                {(u.role === "lead" || u.role === "admin") && <> · all cities</>}
              </div>
            </div>
            {u.id !== currentUserId && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => toggle(u)}>
                {u.active ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
        ))}
      </Card>

      {adding && <AddUserDialog cities={cities} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddUserDialog({ cities, onClose }: { cities: City[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", email: "", password: "", role: "ops", cityIds: [] as string[] });

  const showCities = f.role === "ops";

  function submit() {
    start(async () => {
      const res = await createOpsUser({
        name: f.name, email: f.email, password: f.password, role: f.role as any,
        cityIds: showCities ? f.cityIds : cities.map((c) => c.id),
      });
      if (!res.ok) { toast.error("Couldn't add member", { description: res.error }); return; }
      toast.success("Team member added", { description: `${f.email} can now sign in.` });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>Creates their sign-in and sets what they can see.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Priya Nair" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="priya@quickmove.in" /></div>
            <div className="space-y-1.5"><Label>Temp password</Label><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="min 8 chars" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ops">Ops — assigned cities only</SelectItem>
                <SelectItem value="lead">Lead — all cities</SelectItem>
                <SelectItem value="admin">Admin — full access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showCities && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Cities this person covers</Label>
              <div className="flex flex-wrap gap-1.5">
                {cities.map((c) => {
                  const on = f.cityIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setF({ ...f, cityIds: on ? f.cityIds.filter((x) => x !== c.id) : [...f.cityIds, c.id] })}
                      className={`rounded-md border px-2 py-1 text-xs transition ${on ? "border-brand bg-brand-muted text-brand" : "hover:border-brand/50"}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !f.name || !f.email || f.password.length < 8} onClick={submit}>
            {pending && <Loader2 className="size-4 animate-spin" />} Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
