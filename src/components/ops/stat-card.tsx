import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { StatusTone } from "@/lib/constants";

const toneText: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning-foreground",
  danger: "text-danger",
  info: "text-info",
  brand: "text-brand",
  neutral: "text-foreground",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: StatusTone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className={cn("size-4", toneText[tone])} />}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tabular-nums", toneText[tone])}>
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
