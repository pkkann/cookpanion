/**
 * Small date helpers for the meal plan. Dates are handled as local date-only
 * ISO strings (`YYYY-MM-DD`) to match the backend `PlannedMeal.date` shape — no
 * date library needed.
 */

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a `YYYY-MM-DD` string to a local-midnight Date. */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Today as a local `YYYY-MM-DD` string. */
export function todayIso(): string {
  return toIso(new Date())
}

/** Add (or subtract) whole days to a `YYYY-MM-DD` string. */
export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/** Weekday + day + month for a `YYYY-MM-DD`, in the given locale. */
export function formatWeekdayDate(iso: string, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(parseIso(iso))
}

/** Localized weekday name ("Friday" / "fredag") for a `YYYY-MM-DD`. */
export function formatWeekday(iso: string, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(parseIso(iso))
}
