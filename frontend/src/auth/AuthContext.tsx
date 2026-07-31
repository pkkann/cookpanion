import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearSession, getRefreshToken, getToken, setSession } from '../api/client'
import {
  getMe,
  googleAuth as googleAuthRequest,
  joinHousehold as joinHouseholdRequest,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  updateHousehold as updateHouseholdRequest,
  updateHouseholdLanguage as updateHouseholdLanguageRequest,
  updateMe as updateMeRequest,
} from '../api/endpoints'
import type { User } from '../api/types'
import type { Language } from '../i18n/strings'
import { useLanguage } from '../i18n/LanguageProvider'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  loginWithGoogle: (credential: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  updateHousehold: (name: string) => Promise<void>
  setHouseholdLanguage: (language: Language) => Promise<void>
  setUserLanguage: (language: Language) => Promise<void>
  joinHousehold: (code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { setLang } = useLanguage()

  // The signed-in user's stored language is authoritative for the UI; adopt it
  // whenever the user (re)loads so it follows the account across devices.
  useEffect(() => {
    if (user?.language) setLang(user.language)
  }, [user?.language, setLang])

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

  const login = async (email: string, password: string) => {
    const res = await loginRequest(email, password)
    setSession(res.token, res.refresh_token)
    setUser(res.user)
  }

  const register = async (name: string, email: string, password: string) => {
    const res = await registerRequest(name, email, password)
    setSession(res.token, res.refresh_token)
    setUser(res.user)
  }

  const updateHousehold = async (name: string) => {
    const updated = await updateHouseholdRequest(name)
    setUser(updated)
  }

  const setHouseholdLanguage = async (language: Language) => {
    const updated = await updateHouseholdLanguageRequest(language)
    setUser(updated)
  }

  const setUserLanguage = async (language: Language) => {
    setLang(language) // reflect immediately, then persist
    const updated = await updateMeRequest({ language })
    setUser(updated)
  }

  const joinHousehold = async (code: string) => {
    const updated = await joinHouseholdRequest(code)
    setUser(updated)
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      loginWithGoogle,
      login,
      register,
      updateHousehold,
      setHouseholdLanguage,
      setUserLanguage,
      joinHousehold,
      logout,
    }),
    // Handlers are stable enough (they only close over stable setters/imports);
    // the value is intentionally recomputed only when user/initializing change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
