import { verifyToken } from "@/lib/portal/token";
import { getApartments } from "@/lib/portal/data";
import { ApartmentDecision } from "@/components/portal/apartment-decision";
import { Home } from "lucide-react";

export default async function PortalApartmentsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyToken(token);
  if (!result.ok) return null;

  const apartments = await getApartments(result.relocationId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Your home</h1>
        <p className="text-sm text-muted-foreground">Review the shortlist and approve the one you love.</p>
      </div>
      {apartments.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Home className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="font-medium">Your coordinator is curating options</p>
          <p className="text-sm text-muted-foreground">We&apos;ll show shortlisted homes here soon.</p>
        </div>
      ) : (
        <ApartmentDecision token={token} apartments={apartments as any} />
      )}
    </div>
  );
}
