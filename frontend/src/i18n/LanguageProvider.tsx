import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { daTranslations, isLanguage } from './strings'
import type { Language } from './strings'

const STORAGE_KEY = 'ui_lang'

type TVars = Record<string, string | number>

export type TFunc = (key: string, vars?: TVars) => string

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: TFunc
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function readStored(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    /* localStorage unavailable — fall back to English */
  }
  return 'en'
}

/** Replace {name}-style placeholders with the provided values. */
function interpolate(text: string, vars?: TVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

/**
 * Holds the UI language for this device (persisted in localStorage) and exposes
 * a translate function. English is the source language, so `t` returns the key
 * unchanged for English and looks up a Danish override otherwise.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStored)

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore persistence failures */
    }
  }, [])

  const t = useCallback<TFunc>(
    (key, vars) => {
      const text = lang === 'da' ? (daTranslations[key] ?? key) : key
      return interpolate(text, vars)
    },
    [lang],
  )

  const value = useMemo<LanguageContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

/** Convenience hook for components that only need the translate function. */
// eslint-disable-next-line react-refresh/only-export-components
export function useT(): TFunc {
  return useLanguage().t
}
