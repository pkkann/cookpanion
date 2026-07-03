import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './config'

import enCommon from './locales/en/common.json'
import enNav from './locales/en/nav.json'
import enErrors from './locales/en/errors.json'
import enAuth from './locales/en/auth.json'
import enDashboard from './locales/en/dashboard.json'
import enIngredients from './locales/en/ingredients.json'
import enKitchen from './locales/en/kitchen.json'
import enRecipes from './locales/en/recipes.json'
import enSuggestions from './locales/en/suggestions.json'

import daCommon from './locales/da/common.json'
import daNav from './locales/da/nav.json'
import daErrors from './locales/da/errors.json'
import daAuth from './locales/da/auth.json'
import daDashboard from './locales/da/dashboard.json'
import daIngredients from './locales/da/ingredients.json'
import daKitchen from './locales/da/kitchen.json'
import daRecipes from './locales/da/recipes.json'
import daSuggestions from './locales/da/suggestions.json'

export const defaultNS = 'common'

export const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    errors: enErrors,
    auth: enAuth,
    dashboard: enDashboard,
    ingredients: enIngredients,
    kitchen: enKitchen,
    recipes: enRecipes,
    suggestions: enSuggestions,
  },
  da: {
    common: daCommon,
    nav: daNav,
    errors: daErrors,
    auth: daAuth,
    dashboard: daDashboard,
    ingredients: daIngredients,
    kitchen: daKitchen,
    recipes: daRecipes,
    suggestions: daSuggestions,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    // Treat "en-US" etc. as "en" so the detector never lands on an unsupported dialect.
    load: 'languageOnly',
    defaultNS,
    ns: Object.keys(resources.en),
    interpolation: { escapeValue: false }, // React already escapes.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: { useSuspense: false }, // resources are bundled/synchronous.
  })

export default i18n
