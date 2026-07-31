import { useEffect, useState } from 'react'
import { API_URL } from './client'

export interface AppConfig {
  googleClientId: string
  allowRegistration: boolean
  /** False when the server has no Anthropic API key — AI features are hidden. */
  aiEnabled: boolean
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
      .then((cfg) => ({
        googleClientId: cfg.googleClientId ?? '',
        allowRegistration: cfg.allowRegistration ?? true,
        aiEnabled: cfg.aiEnabled ?? true,
      }))
      // Degrade to defaults: Google sign-in hidden, registration link and AI
      // features shown (the backend still enforces the real toggles).
      .catch(() => ({ googleClientId: '', allowRegistration: true, aiEnabled: true }))
  }
  return configPromise
}

/**
 * Whether AI features should be shown. True while the config loads so the UI
 * doesn't flash; the backend rejects AI calls regardless when unconfigured.
 */
export function useAiEnabled(): boolean {
  const config = useAppConfig()
  return config?.aiEnabled !== false
}

/** The runtime config, or undefined while it's still loading. */
export function useAppConfig(): AppConfig | undefined {
  const [config, setConfig] = useState<AppConfig | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    fetchAppConfig().then((cfg) => {
      if (!cancelled) setConfig(cfg)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return config
}
