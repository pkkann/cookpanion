import type { defaultNS, resources } from './index'

// Makes t('key') type-safe and autocompleted against the English resource set.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}
