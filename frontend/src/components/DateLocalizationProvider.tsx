import type { ReactNode } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

/**
 * Provides the dayjs adapter for all MUI X date pickers. The app is English-only,
 * so the built-in dayjs `en` locale is used.
 */
export default function DateLocalizationProvider({ children }: { children: ReactNode }) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
      {children}
    </LocalizationProvider>
  )
}
