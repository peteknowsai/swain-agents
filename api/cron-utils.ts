/**
 * Cron matching and timezone utilities for the scheduler.
 * Supports: *, fixed numbers, comma-separated lists. No ranges or steps.
 */

/** Check if a value matches a cron field (e.g., "0", "*", "6,12,18") */
function matchesField(field: string, value: number): boolean {
  if (field === "*") return true;
  return field.split(",").some((v) => parseInt(v.trim(), 10) === value);
}

/**
 * Check if a cron expression matches the given hour and minute.
 * Format: "minute hour * * *" (only minute and hour are checked).
 */
export function matchesCron(cron: string, hour: number, minute: number): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 2) return false;
  return matchesField(parts[0], minute) && matchesField(parts[1], hour);
}

/** Convert a Date to local hour/minute in a given IANA timezone. */
export function toLocalTime(date: Date, tz: string): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  // Intl hour12:false returns 24 for midnight in some engines
  return { hour: hour === 24 ? 0 : hour, minute };
}

/** Format a Date as "YYYY-MM-DD-HH-mm" for dedup keys. */
export function formatMinuteKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}`;
}
