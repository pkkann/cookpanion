import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import AuthShell from '../components/AuthShell'

export default function Register() {
  const { user, register } = useAuth()
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
      setError(errorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your kitchen"
      subtitle="Set up a household to track ingredients, stock and recipes together."
      footer={
        <Typography variant="body2" color="text.secondary">
          Already have an account?{' '}
          <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
            Sign in
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
          label="Your name"
          fullWidth
          required
          autoComplete="name"
          margin="normal"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Household name"
          fullWidth
          required
          margin="normal"
          helperText="e.g. “The Smith Family” or “Flat 3B”"
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          fullWidth
          required
          autoComplete="email"
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          required
          autoComplete="new-password"
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordTooShort}
          helperText={passwordTooShort ? 'Use at least 6 characters' : ' '}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={submitting}
          sx={{ mt: 1 }}
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </Box>
    </AuthShell>
  )
}
