import { cn } from "@/lib/utils";
import { TONE_CLASSES, type StatusTone } from "@/lib/constants";

/**
 * Glanceable status chip (build doc §10 — "status as language").
 * Uses the shared semantic palette so ops and portal read identically.
 */
export function StatusChip({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const dotColor: Record<StatusTone, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    brand: "bg-brand",
    neutral: "bg-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotColor[tone])} aria-hidden />}
      {children}
    </span>
  );
}
