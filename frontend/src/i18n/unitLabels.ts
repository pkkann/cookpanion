import { useLanguage } from './LanguageProvider'
import type { Language } from './strings'

/**
 * Danish display labels for the canonical unit values. Units are STORED
 * canonically ('tbsp', 'pcs', …) — only display is translated. Units without
 * an entry (g, kg, ml, l — same in Danish — and legacy free-text values)
 * render unchanged.
 */
const DA_UNITS: Record<string, string> = {
  pcs: 'stk',
  tbsp: 'spsk',
  tsp: 'tsk',
  cup: 'kop',
}

export function unitLabel(unit: string, lang: Language): string {
  if (lang !== 'da') return unit
  return DA_UNITS[unit.trim().toLowerCase()] ?? unit
}

/** Translator for unit display labels in the current UI language. */
export function useUnitLabel(): (unit: string) => string {
  const { lang } = useLanguage()
  return (unit) => unitLabel(unit, lang)
}
