import { useState } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import { useAppConfig } from '../api/config'
import AuthShell from '../components/AuthShell'
import { useT } from '../i18n/LanguageProvider'

const MIN_PASSWORD_LENGTH = 6

export default function Register() {
  const { user, register } = useAuth()
  const appConfig = useAppConfig()
  const t = useT()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  if (appConfig && !appConfig.allowRegistration) {
    return (
      <AuthShell
        title={t('Create your account')}
        subtitle={t('Registration is currently disabled on this installation.')}
        footer={
          <Typography variant="body2" color="text.secondary">
            {t('Already have an account?')}{' '}
            <Link component={RouterLink} to="/login">
              {t('Sign in')}
            </Link>
          </Typography>
        }
      >
        <Alert severity="info">
          {t('Ask a household member for help, or enable registration in the server settings.')}
        </Alert>
      </AuthShell>
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('Password must be at least 6 characters.'))
      return
    }
    setSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password)
      // The new household is unnamed; ProtectedRoute routes through onboarding.
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('Registration failed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('Create your account')}
      subtitle={t("Plan meals and collect your recipes. You'll name your household in the next step.")}
      footer={
        <Typography variant="body2" color="text.secondary">
          {t('Already have an account?')}{' '}
          <Link component={RouterLink} to="/login">
            {t('Sign in')}
          </Link>
        </Typography>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        <TextField
          label={t('Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          autoComplete="name"
          fullWidth
        />
        <TextField
          label={t('Email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          fullWidth
        />
        <TextField
          label={t('Password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          helperText={t('At least 6 characters.')}
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {t('Create account')}
        </Button>
      </Stack>
    </AuthShell>
  )
}
