export function todayLocalDate() {
  return new Date().toISOString().split('T')[0];
}

// UTC-based day math so adding/subtracting days never shifts a date
// due to local timezone/DST — dates here are plain dates, no time.
export function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().split('T')[0];
}
