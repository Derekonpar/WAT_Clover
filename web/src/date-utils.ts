export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function lastWeekRange() {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekday = d.getDay();
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

export function last7DaysRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: isoDate(start), end: isoDate(end) };
}

export function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(minor / 100);
}
