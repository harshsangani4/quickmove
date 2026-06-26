import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { PageHeader } from "@/components/page-header";
import { CopilotChat } from "@/components/ops/copilot-chat";

export default async function CopilotPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: moves } = await supabase
    .from("relocations")
    .select("id, customer:customers(name), city:cities(name)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const options = (moves ?? []).map((m: any) => ({
    id: m.id,
    label: `${m.customer?.name} → ${m.city?.name}`,
  }));

  return (
    <>
      <PageHeader
        title="Ops Copilot"
        description={isAIEnabled() ? "Ask anything across your moves." : "Ask anything — answers are computed from your data (AI offline)."}
      />
      <div className="p-6">
        <CopilotChat moves={options} aiEnabled={isAIEnabled()} />
      </div>
    </>
  );
}
