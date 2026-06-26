import { requireUser } from "@/lib/auth";
import { OpsShell } from "@/components/ops/ops-shell";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <OpsShell user={user}>{children}</OpsShell>;
}
