/** Small helpers for displaying recipe prep/cook times (whole minutes). */

/** Format a minute count as e.g. "45 min", "1 h", or "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${mins} min`
}

/**
 * Human label combining prep and cook times, skipping any that are unset (null)
 * or zero. Returns null when neither is present (nothing to show).
 */
export function formatPrepCook(
  prepTimeMinutes: number | null | undefined,
  cookTimeMinutes: number | null | undefined,
): string | null {
  const parts: string[] = []
  if (prepTimeMinutes) parts.push(`${formatDuration(prepTimeMinutes)} prep`)
  if (cookTimeMinutes) parts.push(`${formatDuration(cookTimeMinutes)} cook`)
  return parts.length > 0 ? parts.join(' · ') : null
}
