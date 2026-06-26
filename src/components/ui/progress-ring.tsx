import { cn } from "@/lib/utils";

/** Compact SVG progress ring (build doc §10 — progress rings everywhere). */
export function ProgressRing({
  value,
  size = 36,
  stroke = 4,
  className,
  tone = "var(--brand)",
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  tone?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={tone}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      <span
        className="absolute text-[10px] font-semibold tabular-nums"
        style={{ fontSize: size * 0.26 }}
      >
        {clamped}
      </span>
    </div>
  );
}
