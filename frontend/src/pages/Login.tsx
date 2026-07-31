import { useState } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import { useAppConfig } from '../api/config'
import AuthShell from '../components/AuthShell'
import GoogleSignInButton, { useGoogleSignInEnabled } from '../auth/GoogleSignInButton'
import { useT } from '../i18n/LanguageProvider'

export default function Login() {
  const { user, login, loginWithGoogle } = useAuth()
  const googleSignInEnabled = useGoogleSignInEnabled()
  const appConfig = useAppConfig()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('Sign-in failed')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async (credential: string) => {
    setError(null)
    try {
      await loginWithGoogle(credential)
      // New accounts have an unnamed household; ProtectedRoute redirects them to
      // the one-time onboarding step. Everyone else lands on their target page.
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('Google sign-in failed')))
    }
  }

  return (
    <AuthShell
      title={t('Welcome to Cookpanion')}
      subtitle={t("Sign in to plan meals with what's already in your kitchen.")}
      footer={
        appConfig?.allowRegistration !== false ? (
          <Typography variant="body2" color="text.secondary">
            {t('New here?')}{' '}
            <Link component={RouterLink} to="/register">
              {t('Create an account')}
            </Link>
          </Typography>
        ) : undefined
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        <TextField
          label={t('Email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          fullWidth
        />
        <TextField
          label={t('Password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {t('Sign in')}
        </Button>
      </Stack>
      {googleSignInEnabled && (
        <>
          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {t('or')}
            </Typography>
          </Divider>
          <GoogleSignInButton onCredential={handleGoogle} />
        </>
      )}
    </AuthShell>
  )
}
