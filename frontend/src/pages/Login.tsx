import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import AuthShell from '../components/AuthShell'
import GoogleSignInButton, { googleSignInEnabled } from '../auth/GoogleSignInButton'

export default function Login() {
  const { t } = useTranslation(['auth', 'errors'])
  const { user, login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={from} replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('errors:login')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async (credential: string) => {
    setError(null)
    try {
      await loginWithGoogle(credential)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('errors:googleSignIn')))
    }
  }

  return (
    <AuthShell
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <Typography variant="body2" color="text.secondary">
          {t('login.noAccount')}{' '}
          <Link component={RouterLink} to="/register" sx={{ fontWeight: 600 }}>
            {t('login.createOne')}
          </Link>
        </Typography>
      }
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label={t('login.email')}
          type="email"
          fullWidth
          required
          autoComplete="email"
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t('login.password')}
          type="password"
          fullWidth
          required
          autoComplete="current-password"
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={submitting}
          sx={{ mt: 2 }}
        >
          {submitting ? t('login.signingIn') : t('login.signIn')}
        </Button>
      </Box>
      {googleSignInEnabled && (
        <>
          <Divider sx={{ my: 2 }}>{t('social.or')}</Divider>
          <GoogleSignInButton onCredential={handleGoogle} />
        </>
      )}
    </AuthShell>
  )
}
