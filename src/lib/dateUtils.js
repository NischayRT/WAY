export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || 'Asia/Kolkata';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
	timeZone: APP_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/** Today's calendar date in the app timezone, as YYYY-MM-DD. */
export function todayLocalDate(date = new Date()) {
	return dayFormatter.format(date);
}

// UTC-based day math so adding/subtracting days never shifts a date
// due to local timezone/DST — dates here are plain dates, no time.
export function addDays(dateStr, delta) {
	const d = new Date(`${dateStr}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().split('T')[0];
}

/** True for a well-formed YYYY-MM-DD string that is a real calendar date. */
export function isValidDateStr(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().split('T')[0] === value;
}

/** Clamps a candidate date into [minDate, maxDate], falling back to maxDate. */
export function clampDate(value, minDate, maxDate) {
	if (!isValidDateStr(value)) return maxDate;
	if (minDate && value < minDate) return minDate;
	if (maxDate && value > maxDate) return maxDate;
	return value;
}