import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function statusTone(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (/(closed|paid|approved|released|arrived|confirmed|cost finalized|sent to supplier)/.test(s)) {
    return "green";
  }
  if (/(delay|reject|cancel|discrepancy|failed|overdue)/.test(s)) return "red";
  if (/(pending|draft|await|review|scheduled|submitted|booked|filed|unverified)/.test(s)) {
    return "amber";
  }
  return "blue";
}
