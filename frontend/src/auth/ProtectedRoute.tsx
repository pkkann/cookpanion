import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from './AuthContext'

export default function ProtectedRoute() {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // A brand-new account starts with an unnamed household; make naming it a
  // one-time gate before the rest of the app. Reload-safe (driven by the stored
  // household name, not a transient sign-in flag).
  // Let an invited new user complete the join (which adopts a named household)
  // instead of being forced to create their own first.
  const isJoining = location.pathname.startsWith('/join/')
  const needsOnboarding = !user.household?.name?.trim()
  if (needsOnboarding && location.pathname !== '/onboarding' && !isJoining) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
