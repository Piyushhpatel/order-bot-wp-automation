/** Restaurant day string YYYY-MM-DD. Resets at dayStartHour in the given timezone. */
export function businessDate(
  timezone = "Asia/Kolkata",
  dayStartHour = 6,
  now = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const pick = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  let year = pick("year");
  let month = pick("month");
  let day = pick("day");
  const hour = pick("hour");

  if (hour < dayStartHour) {
    const shifted = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(shifted);
    return ymd;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
