/** Money is integer paise. 49900 -> "₹499", 49950 -> "₹499.50". */
export function rupees(paise: number) {
  const r = paise / 100;
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** Shift a UTC instant into the event's local wall-clock time, then format it as UTC. */
function local(iso: string, offsetMinutes: number) {
  return new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
}

export function eventDay(iso: string, offset = 330) {
  return local(iso, offset).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function eventTime(iso: string, offset = 330) {
  return local(iso, offset).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}

export function eventDateParts(iso: string, offset = 330) {
  const d = local(iso, offset);
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "UTC" }),
    month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }).toUpperCase(),
  };
}
