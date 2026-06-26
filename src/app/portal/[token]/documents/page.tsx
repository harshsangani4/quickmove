import { verifyToken } from "@/lib/portal/token";
import { getDocuments } from "@/lib/portal/data";
import { getSignedDocUrl } from "@/lib/portal/storage";
import { isAIEnabled } from "@/lib/ai/provider";
import { DocumentUploader, type PortalDoc } from "@/components/portal/document-uploader";
import { ShieldCheck, Info } from "lucide-react";

export default async function PortalDocumentsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyToken(token);
  if (!result.ok) return null;

  const docs = await getDocuments(result.relocationId);
  const withUrls: PortalDoc[] = await Promise.all(
    docs.map(async (d: any) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      reject_reason: d.reject_reason,
      signedUrl: d.file_url ? await getSignedDocUrl(d.file_url) : null,
    })),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground">Upload what we need and keep all your move documents in one secure place.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-info/30 bg-info-muted/40 p-3 text-sm text-muted-foreground">
        {isAIEnabled() ? (
          <>
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
            <span>Uploads are checked automatically against your booking. If something doesn&apos;t match, we&apos;ll tell you exactly what to fix.</span>
          </>
        ) : (
          <>
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <span>Our team reviews every document you upload, usually within a day.</span>
          </>
        )}
      </div>

      <div className="space-y-3">
        {withUrls.map((d) => (
          <DocumentUploader key={d.id} token={token} doc={d} />
        ))}
        {withUrls.length === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No documents requested yet.
          </p>
        )}
      </div>
    </div>
  );
}
