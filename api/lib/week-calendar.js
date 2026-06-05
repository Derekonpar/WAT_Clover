/** Sun–Sat retail weeks (sync with scripts/week_calendar.py). */

function isoLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function lastCompleteSunSatWeek(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = today.getDate();
  const pyWeekday = (new Date(y, m, day).getDay() + 6) % 7;
  let daysSinceSat = (pyWeekday - 5) % 7;
  if (daysSinceSat === 0) daysSinceSat = 7;
  const weekEnd = new Date(y, m, day - daysSinceSat);
  const weekStart = new Date(
    weekEnd.getFullYear(),
    weekEnd.getMonth(),
    weekEnd.getDate() - 6,
  );
  return {
    start: isoLocalDate(weekStart),
    end: isoLocalDate(weekEnd),
    weekStart,
    weekEnd,
  };
}

export function lastNWeekRanges(n, today = new Date()) {
  const { weekStart, weekEnd } = lastCompleteSunSatWeek(today);
  const ranges = [[isoLocalDate(weekStart), isoLocalDate(weekEnd)]];
  let end = weekEnd;
  for (let i = 1; i < n; i++) {
    end = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    ranges.push([isoLocalDate(start), isoLocalDate(end)]);
  }
  return ranges;
}

export function sunSatWeekLabel(weekStart, weekEnd) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ws = new Date(`${weekStart}T12:00:00`);
  const we = new Date(`${weekEnd}T12:00:00`);
  return `Sun ${months[ws.getMonth()]} ${ws.getDate()} – Sat ${months[we.getMonth()]} ${we.getDate()}`;
}
