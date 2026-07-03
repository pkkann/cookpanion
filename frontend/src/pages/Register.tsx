import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
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

export default function Register() {
  const { t } = useTranslation(['auth', 'errors'])
  const { user, register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const passwordTooShort = password.length > 0 && password.length < 6

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (passwordTooShort) return
    setError(null)
    setSubmitting(true)
    try {
      await register({ name, email, password, householdName })
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('errors:register')))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async (credential: string) => {
    setError(null)
    try {
      await loginWithGoogle(credential)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('errors:googleSignIn')))
    }
  }

  return (
    <AuthShell
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <Typography variant="body2" color="text.secondary">
          {t('register.haveAccount')}{' '}
          <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
            {t('register.signIn')}
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
          label={t('register.name')}
          fullWidth
          required
          autoComplete="name"
          margin="normal"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label={t('register.householdName')}
          fullWidth
          required
          margin="normal"
          helperText={t('register.householdNameHelp')}
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
        />
        <TextField
          label={t('register.email')}
          type="email"
          fullWidth
          required
          autoComplete="email"
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t('register.password')}
          type="password"
          fullWidth
          required
          autoComplete="new-password"
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordTooShort}
          helperText={passwordTooShort ? t('register.passwordTooShort') : ' '}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={submitting}
          sx={{ mt: 1 }}
        >
          {submitting ? t('register.creatingAccount') : t('register.createAccount')}
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
