import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import AuthShell from '../components/AuthShell'
import { useT } from '../i18n/LanguageProvider'

/**
 * One-time step shown right after a new account is created via Google, so the
 * user can name their household (auto-named from their Google name until now).
 * Reachable only while authenticated; renaming later lives in Settings.
 */
export default function Onboarding() {
  const { user, updateHousehold } = useAuth()
  const t = useT()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.household?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  // Already named (or renamed elsewhere) → nothing to onboard.
  if (user.household?.name?.trim()) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    setSubmitting(true)
    try {
      await updateHousehold(trimmed)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err, t('Could not save household name')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('Name your kitchen')}
      subtitle={t(
        'Give your household a name so you can share recipes and meal plans. You can change it later in settings.',
      )}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label={t('Household name')}
          fullWidth
          required
          autoFocus
          margin="normal"
          helperText={t('e.g. “The Smith Family” or “Flat 3B”')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={submitting || !name.trim()}
          sx={{ mt: 1 }}
        >
          {t('Continue')}
        </Button>
      </Box>
    </AuthShell>
  )
}
