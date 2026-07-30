import { API_URL } from './client'

export interface AppConfig {
  googleClientId: string
}

// Fetched once per page load and shared by all callers. Uses plain fetch (not
// the axios instance) so no auth headers or refresh logic get involved — the
// endpoint is public and needed before anyone is signed in.
let configPromise: Promise<AppConfig> | null = null

export function fetchAppConfig(): Promise<AppConfig> {
  if (!configPromise) {
    configPromise = fetch(`${API_URL}/config`)
      .then((res) => {
        if (!res.ok) throw new Error(`config fetch failed: ${res.status}`)
        return res.json() as Promise<AppConfig>
      })
      .then((cfg) => ({ googleClientId: cfg.googleClientId ?? '' }))
      // Degrade like an unset client id: Google sign-in simply stays hidden.
      .catch(() => ({ googleClientId: '' }))
  }
  return configPromise
}
