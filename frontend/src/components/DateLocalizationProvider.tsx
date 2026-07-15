import type { ReactNode } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { useTranslation } from 'react-i18next'
import 'dayjs/locale/da' // `en` is built into dayjs; `da` must be imported.

/**
 * Provides the dayjs adapter for all MUI X date pickers, localized to the app's
 * current language. Reading `i18n.language` here (a component) keeps the picker
 * calendar in sync when the user switches language.
 */
export default function DateLocalizationProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith('da') ? 'da' : 'en'

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
      {children}
    </LocalizationProvider>
  )
}
