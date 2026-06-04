/** Sun–Sat week helpers (match scripts/week_calendar.py). */

export type SunSatWeek = { start: string; end: string };

export function lastCompleteSunSatWeek(today = new Date()): SunSatWeek {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekday = d.getDay(); // 0=Sun … 6=Sat
  let daysSinceSat: number;
  if (weekday === 6) {
    daysSinceSat = 7;
  } else {
    daysSinceSat = (weekday + 1) % 7;
    if (daysSinceSat === 0) daysSinceSat = 7;
  }
  const end = new Date(d);
  end.setDate(d.getDate() - daysSinceSat);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const BEER_PAR_READY_KEY = "wat-beer-par-ready-week";

export function isParReadyForOrderWeek(weekEnd: string): boolean {
  try {
    return localStorage.getItem(BEER_PAR_READY_KEY) === weekEnd;
  } catch {
    return false;
  }
}

export function markParReadyForOrderWeek(weekEnd: string) {
  localStorage.setItem(BEER_PAR_READY_KEY, weekEnd);
}

export function formatSunSatWeekLabel(start: string, end: string): string {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Sun ${fmt(s)} – Sat ${fmt(e)}`;
}
