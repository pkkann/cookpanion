import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import AuthShell from '../components/AuthShell'
import GoogleSignInButton, { googleSignInEnabled } from '../auth/GoogleSignInButton'

export default function Login() {
  const { user, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  const handleGoogle = async (credential: string) => {
    setError(null)
    try {
      await loginWithGoogle(credential)
      // New accounts have an unnamed household; ProtectedRoute redirects them to
      // the one-time onboarding step. Everyone else lands on their target page.
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, "Google sign-in failed"))
    }
  }

  return (
    <AuthShell
      title="Welcome to Cookpanion"
      subtitle="Sign in with Google to plan meals with what's already in your kitchen. New here? Signing in creates your account."
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {googleSignInEnabled ? (
        <GoogleSignInButton onCredential={handleGoogle} />
      ) : (
        <Alert severity="info">Sign-in isn't available right now. Please try again later.</Alert>
      )}
    </AuthShell>
  )
}
