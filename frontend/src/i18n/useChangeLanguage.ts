import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { updateMe } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import type { Language } from './config'

/**
 * Returns a function that switches the UI language: it updates i18next (and the
 * localStorage cache) instantly, mirrors the change onto the AuthContext user,
 * and — when a user is logged in — persists the choice to the backend.
 * On the pre-auth pages (no user) it relies on the localStorage cache only.
 */
export function useChangeLanguage() {
  const { i18n } = useTranslation()
  const { user, setUserLocale } = useAuth()
  const persist = useMutation({ mutationFn: (locale: Language) => updateMe({ locale }) })

  return {
    language: i18n.language as Language,
    changeLanguage: (locale: Language) => {
      void i18n.changeLanguage(locale)
      if (user) {
        setUserLocale(locale)
        persist.mutate(locale)
      }
    },
  }
}
