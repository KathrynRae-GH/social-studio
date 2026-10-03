import type { AssetView } from "../../../shared/content.ts";
import { STATUS_LABELS, channel, type EntryStatus } from "../../../shared/channels.ts";

export function StatusChip({ status, dryRun }: { status: EntryStatus; dryRun?: boolean }) {
  return (
    <span className={`status-chip status-${status}`}>
      {dryRun ? "Approved (posting off)" : STATUS_LABELS[status]}
    </span>
  );
}

export function Thumb({ asset, className = "thumb" }: { asset: AssetView | null | undefined; className?: string }) {
  if (!asset) return <div className={`${className} thumb-empty`} aria-hidden="true">Aa</div>;
  if (asset.mime.startsWith("video/")) {
    return <video className={className} src={`${asset.url}#t=0.5`} muted playsInline preload="metadata" />;
  }
  return <img className={className} src={asset.url} alt="" loading="lazy" />;
}

export function channelName(id: string): string {
  return channel(id)?.name ?? id;
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// "2026-10-20" → "Tue, Oct 20" (the date is already in the shop's time zone).
export function friendlyDate(date: string): string {
  return DAY.format(new Date(`${date}T12:00:00Z`));
}

// "14:30" → "2:30 pm"
export function friendlyTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = ((h! + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${h! < 12 ? "am" : "pm"}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The Sunday on or before a date.
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return addDays(date, -d.getUTCDay());
}

// Today in the shop's time zone.
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function ErrorNote({ message }: { message: string }) {
  return message ? <p className="error">{message}</p> : null;
}
