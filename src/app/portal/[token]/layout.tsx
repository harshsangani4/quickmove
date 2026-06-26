import { verifyToken } from "@/lib/portal/token";
import { getPortalSummary } from "@/lib/portal/data";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalExpired } from "@/components/portal/portal-expired";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyToken(token);
  if (!result.ok) return <PortalExpired reason={result.reason} />;

  const summary = await getPortalSummary(result.relocationId);
  if (!summary) return <PortalExpired reason="not_found" />;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-brand-muted/10">
      <PortalNav token={token} cityName={summary.city?.name ?? "your new city"} />
      <main className="mx-auto max-w-2xl px-5 pb-28 pt-6 sm:pb-12">{children}</main>
    </div>
  );
}
