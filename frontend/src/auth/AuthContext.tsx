import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearSession, getRefreshToken, getToken, setSession } from '../api/client'
import {
  getMe,
  googleAuth as googleAuthRequest,
  logout as logoutRequest,
} from '../api/endpoints'
import type { User } from '../api/types'
import i18n from '../i18n'
import type { Language } from '../i18n/config'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  loginWithGoogle: (credential: string) => Promise<void>
  logout: () => void
  setUserLocale: (locale: Language) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  // On boot, if we hold a token, hydrate the current user from /me.
  useEffect(() => {
    let active = true
    const token = getToken()
    if (!token) {
      setInitializing(false)
      return
    }
    getMe()
      .then((u) => {
        if (active) setUser(u)
      })
      .catch(() => {
        if (active) {
          clearSession()
          setUser(null)
        }
      })
      .finally(() => {
        if (active) setInitializing(false)
      })
    return () => {
      active = false
    }
  }, [])

  const loginWithGoogle = async (credential: string) => {
    const res = await googleAuthRequest(credential)
    setSession(res.token, res.refresh_token)
    setUser(res.user)
  }

  const logout = () => {
    // Best-effort server-side revocation, then clear locally regardless.
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      void logoutRequest(refreshToken).catch(() => {})
    }
    clearSession()
    setUser(null)
  }

  const setUserLocale = useCallback((locale: Language) => {
    setUser((u) => (u ? { ...u, locale } : u))
  }, [])

  // Keep the UI language in sync with the authenticated user's stored locale.
  // `/me` (and login/register) is authoritative; the localStorage cache only
  // drives the first paint before the user resolves.
  useEffect(() => {
    if (user?.locale && user.locale !== i18n.language) {
      void i18n.changeLanguage(user.locale)
    }
  }, [user?.locale])

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, loginWithGoogle, logout, setUserLocale }),
    [user, initializing, setUserLocale],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
