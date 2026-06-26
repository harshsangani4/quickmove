import { differenceInCalendarDays, format, parseISO } from "date-fns";

/** "in 5 days" / "today" / "3 days ago" relative to now. */
export function relativeDays(dateISO: string | null, now: Date = new Date()): string {
  if (!dateISO) return "—";
  const d = differenceInCalendarDays(parseISO(dateISO), now);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  if (d > 0) return `in ${d} days`;
  return `${Math.abs(d)} days ago`;
}

export function formatDate(dateISO: string | null): string {
  if (!dateISO) return "—";
  return format(parseISO(dateISO), "d MMM yyyy");
}

export function formatShortDate(dateISO: string | null): string {
  if (!dateISO) return "—";
  return format(parseISO(dateISO), "d MMM");
}

/** INR amount (stored in rupees). */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isOverdue(dateISO: string | null, now: Date = new Date()): boolean {
  if (!dateISO) return false;
  return differenceInCalendarDays(parseISO(dateISO), now) < 0;
}
