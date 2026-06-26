"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, Download, CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadDocument } from "@/lib/actions/portal";

export interface PortalDoc {
  id: string;
  type: string;
  status: string;
  reject_reason: string | null;
  signedUrl: string | null;
}

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Needed", cls: "text-muted-foreground bg-muted", icon: Clock },
  uploaded: { label: "Received — under review", cls: "text-info bg-info-muted", icon: Clock },
  validating: { label: "Checking…", cls: "text-info bg-info-muted", icon: Loader2 },
  validated: { label: "Verified", cls: "text-success bg-success-muted", icon: CheckCircle2 },
  rejected: { label: "Needs another look", cls: "text-danger bg-danger-muted", icon: AlertTriangle },
};

export function DocumentUploader({ token, doc }: { token: string; doc: PortalDoc }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const meta = STATUS[doc.status] ?? STATUS.pending;
  const Icon = meta.icon;
  const canUpload = doc.status === "pending" || doc.status === "rejected";

  function upload(file: File) {
    const fd = new FormData();
    fd.set("documentId", doc.id);
    fd.set("file", file);
    start(async () => {
      const res = await uploadDocument(token, fd);
      if (!res.ok) { toast.error("Upload failed", { description: res.error }); return; }
      toast.success("Uploaded", { description: "We've received your document." });
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileText className="size-4" />
          </div>
          <div>
            <div className="font-medium">{doc.type}</div>
            <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.cls)}>
              <Icon className={cn("size-3", doc.status === "validating" && "animate-spin")} /> {meta.label}
            </span>
            {doc.status === "rejected" && doc.reject_reason && (
              <p className="mt-1 text-xs text-danger">{doc.reject_reason}</p>
            )}
          </div>
        </div>
        {doc.signedUrl && (
          <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            <Download className="size-3.5" /> View
          </a>
        )}
      </div>

      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={cn(
            "mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-colors",
            dragOver && "border-brand bg-brand-muted/40",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {doc.status === "rejected" ? "Re-upload" : "Upload"}
          </Button>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Drag &amp; drop or browse · PDF, JPG, PNG · max 8 MB</p>
        </div>
      )}
    </div>
  );
}
