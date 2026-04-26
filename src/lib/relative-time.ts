/**
 * Tiny "n minutes/hours/days ago" formatter. Uses Intl.RelativeTimeFormat
 * for proper localization. Falls back to date string for >30 days.
 */
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 30 * 86400)
    return rtf.format(Math.round(diffSec / 86400), "day");
  return d.toLocaleDateString();
}
