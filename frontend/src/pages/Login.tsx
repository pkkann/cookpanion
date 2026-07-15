import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import AuthShell from '../components/AuthShell'
import GoogleSignInButton, { googleSignInEnabled } from '../auth/GoogleSignInButton'

export default function Login() {
  const { t } = useTranslation(['auth', 'errors'])
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
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('errors:googleSignIn')))
    }
  }

  return (
    <AuthShell title={t('login.title')} subtitle={t('login.subtitle')}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {googleSignInEnabled ? (
        <GoogleSignInButton onCredential={handleGoogle} />
      ) : (
        <Alert severity="info">{t('login.notConfigured')}</Alert>
      )}
    </AuthShell>
  )
}
