"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/status-chip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  upsertTemplate, deleteTemplate, upsertVendor, setVendorActive,
  upsertUtility, deleteUtility, upsertDocRequirement, deleteDocRequirement,
} from "@/lib/actions/cities";
import { CATEGORY_META, PROOF_TYPE_LABEL } from "@/lib/constants";

export function CityEditor({
  cityId, activeMoves, templates, vendors, utilities, docs,
}: {
  cityId: string;
  activeMoves: number;
  templates: any[];
  vendors: any[];
  utilities: any[];
  docs: any[];
}) {
  return (
    <div className="space-y-4">
      <Card className="flex-row items-start gap-3 border-info/30 bg-info-muted/40 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p className="text-muted-foreground">
          Changes here affect <span className="font-medium text-foreground">future moves only</span>.{" "}
          {activeMoves} active move{activeMoves === 1 ? "" : "s"} keep their current checklist.
        </p>
      </Card>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Task templates</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="utilities">Utilities</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="templates"><TemplatesTab cityId={cityId} templates={templates} /></TabsContent>
        <TabsContent value="vendors"><VendorsTab cityId={cityId} vendors={vendors} /></TabsContent>
        <TabsContent value="utilities"><UtilitiesTab cityId={cityId} utilities={utilities} /></TabsContent>
        <TabsContent value="docs"><DocsTab cityId={cityId} docs={docs} /></TabsContent>
      </Tabs>
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void, okMsg = "Saved") {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error("Couldn't save", { description: res.error });
        return;
      }
      toast.success(okMsg);
      onOk?.();
      router.refresh();
    });
  }
  return { pending, run };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
function TemplatesTab({ cityId, templates }: { cityId: string; templates: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const { pending, run } = useAction();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add task</Button>
      </div>
      <Card className="divide-y p-0">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{t.title}</span>
                <Badge variant="outline" className="text-[10px]">{CATEGORY_META[t.category as keyof typeof CATEGORY_META]?.label}</Badge>
                {t.requires_proof && (
                  <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck className="size-3" />{PROOF_TYPE_LABEL[t.proof_type] ?? "proof"}</Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1">{t.key}</code> · due {t.lead_time_days} days from move · weight {t.weight}
                {(t.depends_on ?? []).length > 0 && <> · needs {t.depends_on.join(", ")}</>}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(t)} aria-label="Edit"><Pencil className="size-4" /></Button>
            <DeleteTemplateButton template={t} />
          </div>
        ))}
        {templates.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No templates yet.</p>}
      </Card>

      {(adding || editing) && (
        <TemplateDialog
          cityId={cityId}
          template={editing}
          allKeys={templates.map((t) => t.key)}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={(data) => run(() => upsertTemplate(data), () => { setAdding(false); setEditing(null); })}
          pending={pending}
        />
      )}
    </div>
  );
}

function DeleteTemplateButton({ template }: { template: any }) {
  const { pending, run } = useAction();
  const [confirm, setConfirm] = useState<string[] | null>(null);

  function attempt(force = false) {
    run(async () => {
      const res = await deleteTemplate(template.id, { force });
      if (!res.ok && res.error?.startsWith("Referenced by:")) {
        setConfirm(res.error.replace("Referenced by:", "").split(",").map((s) => s.trim()));
        return { ok: true }; // handled via dialog, don't toast error
      }
      return res;
    }, undefined, "Template deleted");
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="size-8 text-danger" onClick={() => attempt(false)} disabled={pending} aria-label="Delete">
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              It&apos;s referenced by: {confirm?.join(", ")}. Deleting will remove this dependency from them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Keep</Button>
            <Button variant="destructive" onClick={() => { setConfirm(null); attempt(true); }}>Delete anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateDialog({
  cityId, template, allKeys, onClose, onSave, pending,
}: {
  cityId: string;
  template: any | null;
  allKeys: string[];
  onClose: () => void;
  onSave: (data: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    key: template?.key ?? "",
    title: template?.title ?? "",
    category: template?.category ?? "utility",
    lead_time_days: template?.lead_time_days ?? -7,
    requires_proof: template?.requires_proof ?? false,
    proof_type: template?.proof_type ?? "account_no",
    weight: template?.weight ?? 1,
    depends_on: (template?.depends_on ?? []) as string[],
  });

  const candidateDeps = allKeys.filter((k) => k !== template?.key);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit task template" : "New task template"}</DialogTitle>
          <DialogDescription>Defines a step in this city&apos;s generated checklist.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Key</Label>
              <Input value={form.key} disabled={!!template} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="internet_setup" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Set up internet / broadband" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lead time (days from move; negative = before)</Label>
              <Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input type="number" min={1} max={5} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="rp" checked={form.requires_proof} onCheckedChange={(c) => setForm({ ...form, requires_proof: !!c })} />
            <Label htmlFor="rp" className="cursor-pointer">Requires proof to complete</Label>
          </div>
          {form.requires_proof && (
            <div className="space-y-1.5">
              <Label>Proof type</Label>
              <Select value={form.proof_type} onValueChange={(v) => setForm({ ...form, proof_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROOF_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {candidateDeps.length > 0 && (
            <div className="space-y-1.5">
              <Label>Depends on</Label>
              <div className="flex flex-wrap gap-1.5">
                {candidateDeps.map((k) => {
                  const on = form.depends_on.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm({ ...form, depends_on: on ? form.depends_on.filter((d) => d !== k) : [...form.depends_on, k] })}
                      className={`rounded-md border px-2 py-1 text-xs transition ${on ? "border-brand bg-brand-muted text-brand" : "hover:border-brand/50"}`}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !form.key || !form.title}
            onClick={() => onSave({ ...form, id: template?.id, city_id: cityId, proof_type: form.requires_proof ? form.proof_type : null })}
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
function VendorsTab({ cityId, vendors }: { cityId: string; vendors: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const { pending, run } = useAction();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add vendor</Button>
      </div>
      <Card className="divide-y p-0">
        {vendors.map((v) => (
          <div key={v.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{v.name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{v.type}</Badge>
                {!v.active && <StatusChip tone="neutral" dot={false}>inactive</StatusChip>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {v.on_time_pct}% on-time · {v.issue_rate}% issues · ★ {v.rating}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => run(() => setVendorActive(v.id, !v.active), undefined, v.active ? "Deactivated" : "Activated")} disabled={pending}>
              {v.active ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(v)} aria-label="Edit"><Pencil className="size-4" /></Button>
          </div>
        ))}
        {vendors.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No vendors yet.</p>}
      </Card>
      {(adding || editing) && (
        <VendorDialog cityId={cityId} vendor={editing} onClose={() => { setAdding(false); setEditing(null); }}
          onSave={(d: any) => run(() => upsertVendor(d), () => { setAdding(false); setEditing(null); })} pending={pending} />
      )}
    </div>
  );
}

function VendorDialog({ cityId, vendor, onClose, onSave, pending }: any) {
  const [f, setF] = useState({
    name: vendor?.name ?? "", type: vendor?.type ?? "movers", contact: vendor?.contact ?? "",
    on_time_pct: vendor?.on_time_pct ?? 90, issue_rate: vendor?.issue_rate ?? 5, rating: vendor?.rating ?? 4.5,
    active: vendor?.active ?? true,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{vendor ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="property">Property</SelectItem><SelectItem value="movers">Movers</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Contact</Label><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>On-time %</Label><Input type="number" value={f.on_time_pct} onChange={(e) => setF({ ...f, on_time_pct: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Issue %</Label><Input type="number" value={f.issue_rate} onChange={(e) => setF({ ...f, issue_rate: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Rating</Label><Input type="number" step="0.1" value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !f.name} onClick={() => onSave({ ...f, id: vendor?.id, city_id: cityId })}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function UtilitiesTab({ cityId, utilities }: { cityId: string; utilities: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const { pending, run } = useAction();
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add utility</Button></div>
      <Card className="divide-y p-0">
        {utilities.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-sm font-medium">{u.name}</span><Badge variant="outline" className="text-[10px] capitalize">{u.type}</Badge></div>
              <div className="mt-0.5 text-xs text-muted-foreground">~{u.avg_setup_days} days to set up{u.contact ? ` · ${u.contact}` : ""}</div>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(u)} aria-label="Edit"><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-8 text-danger" onClick={() => run(() => deleteUtility(u.id, cityId), undefined, "Deleted")} disabled={pending} aria-label="Delete"><Trash2 className="size-4" /></Button>
          </div>
        ))}
        {utilities.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No utilities yet.</p>}
      </Card>
      {(adding || editing) && (
        <UtilityDialog cityId={cityId} utility={editing} onClose={() => { setAdding(false); setEditing(null); }}
          onSave={(d: any) => run(() => upsertUtility(d), () => { setAdding(false); setEditing(null); })} pending={pending} />
      )}
    </div>
  );
}

function UtilityDialog({ cityId, utility, onClose, onSave, pending }: any) {
  const [f, setF] = useState({ type: utility?.type ?? "internet", name: utility?.name ?? "", avg_setup_days: utility?.avg_setup_days ?? 7, contact: utility?.contact ?? "" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{utility ? "Edit utility" : "New utility"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["electricity", "internet", "gas", "water"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Avg setup days</Label><Input type="number" value={f.avg_setup_days} onChange={(e) => setF({ ...f, avg_setup_days: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Provider name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Contact</Label><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !f.name} onClick={() => onSave({ ...f, id: utility?.id, city_id: cityId })}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
function DocsTab({ cityId, docs }: { cityId: string; docs: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const { pending, run } = useAction();
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Add document</Button></div>
      <Card className="divide-y p-0">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{d.name}</span>
                {d.mandatory && <Badge variant="outline" className="text-[10px]">required</Badge>}
                <Badge variant="outline" className="text-[10px] capitalize">{d.applies_to}</Badge>
              </div>
              {d.notes && <div className="mt-0.5 text-xs text-muted-foreground">{d.notes}</div>}
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(d)} aria-label="Edit"><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-8 text-danger" onClick={() => run(() => deleteDocRequirement(d.id, cityId), undefined, "Deleted")} disabled={pending} aria-label="Delete"><Trash2 className="size-4" /></Button>
          </div>
        ))}
        {docs.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No document rules yet.</p>}
      </Card>
      {(adding || editing) && (
        <DocDialog cityId={cityId} doc={editing} onClose={() => { setAdding(false); setEditing(null); }}
          onSave={(d: any) => run(() => upsertDocRequirement(d), () => { setAdding(false); setEditing(null); })} pending={pending} />
      )}
    </div>
  );
}

function DocDialog({ cityId, doc, onClose, onSave, pending }: any) {
  const [f, setF] = useState({ name: doc?.name ?? "", applies_to: doc?.applies_to ?? "relocation", mandatory: doc?.mandatory ?? true, notes: doc?.notes ?? "" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{doc ? "Edit document rule" : "New document rule"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Applies to</Label>
              <Select value={f.applies_to} onValueChange={(v) => setF({ ...f, applies_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="relocation">Relocation</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="mand" checked={f.mandatory} onCheckedChange={(c) => setF({ ...f, mandatory: !!c })} />
              <Label htmlFor="mand" className="cursor-pointer">Mandatory</Label>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !f.name} onClick={() => onSave({ ...f, id: doc?.id, city_id: cityId })}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
