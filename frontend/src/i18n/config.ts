// Central i18n constants. Keep SUPPORTED_LANGUAGES in sync with the backend
// AuthController::SUPPORTED_LOCALES.

export const SUPPORTED_LANGUAGES = ['en', 'da'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

// localStorage key used to cache the chosen language (mirrors TOKEN_KEY in api/client.ts).
export const LANGUAGE_STORAGE_KEY = 'recipe_ai_lang'

// Human-readable names shown in the language switcher.
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  da: 'Dansk',
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}
