import { verifyToken } from "@/lib/portal/token";
import { getMessages } from "@/lib/portal/data";
import { PortalMessageThread } from "@/components/portal/portal-message-thread";

export default async function PortalMessagesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyToken(token);
  if (!result.ok) return null;
  const messages = await getMessages(result.relocationId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">Chat directly with your relocation coordinator.</p>
      </div>
      <PortalMessageThread token={token} messages={messages as any} />
    </div>
  );
}
