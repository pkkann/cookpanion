import { useLanguage, useT } from '../i18n/LanguageProvider'
import { addDaysIso, formatWeekday, formatWeekdayDate, todayIso } from './date'

/**
 * Human label for a meal-plan date, in the current UI language:
 * "Today", "Tomorrow", "This Friday" for dates within the coming week,
 * and a full localized date beyond that (where the weekday name alone
 * would be ambiguous).
 */
export function usePlanDateLabel(): (iso: string) => string {
  const { lang } = useLanguage()
  const t = useT()

  return (iso: string) => {
    const today = todayIso()
    if (iso === today) return t('Today')
    if (iso === addDaysIso(today, 1)) return t('Tomorrow')
    if (iso > today && iso < addDaysIso(today, 7)) {
      return t('This {weekday}', { weekday: formatWeekday(iso, lang) })
    }
    return formatWeekdayDate(iso, lang)
  }
}
