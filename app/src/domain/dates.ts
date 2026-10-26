// Fume's dates.

/** Fume's dates count working days, Monday to Friday: the day that many working days after a moment. */
export function addWorkingDays(from: string, days: number): string {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  return d.toISOString();
}
