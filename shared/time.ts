// Times are chosen and shown in the shop's own time zone ("9:00 am" means
// 9 am in Dallas for a Dallas shop) and stored and sent to Boutiqly in UTC.

function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

// "2026-10-20", "09:00", "America/Chicago" → the UTC instant.
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Not a valid date and time: ${date} ${time}`);
  }
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset on either side of a daylight-saving change.
  let utc = wall - offsetMinutes(wall, timeZone) * 60000;
  utc = wall - offsetMinutes(utc, timeZone) * 60000;
  return new Date(utc);
}

// A UTC instant → the shop's local date ("2026-10-20") and time ("09:00").
export function utcToZoned(instant: Date | string, timeZone: string): { date: string; time: string } {
  const ms = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  const local = new Date(ms + offsetMinutes(ms, timeZone) * 60000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_TIME_ZONE = "America/Chicago";
