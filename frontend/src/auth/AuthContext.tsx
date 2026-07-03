import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearToken, getToken, setToken } from '../api/client'
import {
  getMe,
  googleAuth as googleAuthRequest,
  login as loginRequest,
  register as registerRequest,
} from '../api/endpoints'
import type { LoginPayload, RegisterPayload, User } from '../api/types'
import i18n from '../i18n'
import type { Language } from '../i18n/config'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
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
          clearToken()
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

  const login = async (payload: LoginPayload) => {
    const res = await loginRequest(payload)
    setToken(res.token)
    setUser(res.user)
  }

  const register = async (payload: RegisterPayload) => {
    const res = await registerRequest(payload)
    setToken(res.token)
    setUser(res.user)
  }

  const loginWithGoogle = async (credential: string) => {
    const res = await googleAuthRequest(credential)
    setToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
    clearToken()
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
    () => ({ user, initializing, login, register, loginWithGoogle, logout, setUserLocale }),
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
