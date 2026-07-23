import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearSession, getRefreshToken, getToken, setSession } from '../api/client'
import {
  getMe,
  googleAuth as googleAuthRequest,
  joinHousehold as joinHouseholdRequest,
  logout as logoutRequest,
  updateHousehold as updateHouseholdRequest,
} from '../api/endpoints'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  loginWithGoogle: (credential: string) => Promise<void>
  updateHousehold: (name: string) => Promise<void>
  joinHousehold: (code: string) => Promise<void>
  logout: () => void
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

  const updateHousehold = async (name: string) => {
    const updated = await updateHouseholdRequest(name)
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
      updateHousehold,
      joinHousehold,
      logout,
    }),
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
