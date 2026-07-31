/** Small helpers for displaying recipe prep/cook times (whole minutes). */

import { useT } from '../i18n/LanguageProvider'
import type { TFunc } from '../i18n/LanguageProvider'

/**
 * Format a minute count as e.g. "45 min", "1 h", or "1 h 30 min". The unit
 * abbreviations are localized ("h" → "t" in Danish).
 */
export function formatDuration(minutes: number, t: TFunc): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return t('{count} min', { count: mins })
  if (mins === 0) return t('{count} h', { count: hours })
  return `${t('{count} h', { count: hours })} ${t('{count} min', { count: mins })}`
}

/**
 * Human label combining prep and cook times, skipping any that are unset (null)
 * or zero. Returns null when neither is present (nothing to show).
 */
export function formatPrepCook(
  prepTimeMinutes: number | null | undefined,
  cookTimeMinutes: number | null | undefined,
  t: TFunc,
): string | null {
  const parts: string[] = []
  if (prepTimeMinutes) {
    parts.push(t('{duration} prep', { duration: formatDuration(prepTimeMinutes, t) }))
  }
  if (cookTimeMinutes) {
    parts.push(t('{duration} cook', { duration: formatDuration(cookTimeMinutes, t) }))
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Duration formatter bound to the current UI language. */
export function useFormatDuration(): (minutes: number) => string {
  const t = useT()
  return (minutes) => formatDuration(minutes, t)
}

/** Prep/cook label formatter bound to the current UI language. */
export function useFormatPrepCook(): (
  prepTimeMinutes: number | null | undefined,
  cookTimeMinutes: number | null | undefined,
) => string | null {
  const t = useT()
  return (prep, cook) => formatPrepCook(prep, cook, t)
}
