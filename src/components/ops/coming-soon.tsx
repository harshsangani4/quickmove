import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Hammer } from "lucide-react";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="p-6">
        <EmptyState
          icon={Hammer}
          title={`${title} arrives in ${phase}`}
          description="This area is part of a later build milestone. The data spine is already in place — the screen is on its way."
        />
      </div>
    </>
  );
}
