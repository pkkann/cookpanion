import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import type { ApiError, RefreshResponse } from './types'

// Relative by default: the SPA and API share one origin (served behind nginx),
// so requests go to "/api" on whatever host loaded the page — no baked-in IP.
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

// Short-lived access token (~1h) and the long-lived refresh token (~30d) that
// silently mints new access tokens, so users stay signed in across restarts.
const TOKEN_KEY = 'recipe_ai_token'
const REFRESH_KEY = 'recipe_ai_refresh_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setSession(token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the JWT to every request when present.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A single in-flight refresh shared by all requests that hit a 401 at once, so
// concurrent calls don't each fire their own refresh and race on rotation.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    // Bare axios (not `api`): no request interceptor, so no stale Bearer header,
    // and no response interceptor, so no recursion back into this handler.
    const { data } = await axios.post<RefreshResponse>(
      `${API_URL}/token/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )
    setSession(data.token, data.refresh_token)
    return data.token
  } catch {
    return null
  }
}

function redirectToLogin(): void {
  const path = window.location.pathname
  if (path !== '/login' && path !== '/register') {
    window.location.assign('/login')
  }
}

// On 401, try once to refresh the access token and replay the request. If the
// refresh token is missing/expired/revoked, the session is truly over: clear it
// and bounce to /login (except while already on the auth pages).
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const isRefreshCall = original?.url?.includes('/token/refresh')

    if (error.response?.status === 401 && original && !original._retried && !isRefreshCall) {
      original._retried = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      clearSession()
      redirectToLogin()
    }
    return Promise.reject(error)
  },
)

/** Extract a human-friendly message from an axios error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined
    if (data?.error) return data.error
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

/** HTTP status code of an axios error, or undefined. */
export function errorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined
}
