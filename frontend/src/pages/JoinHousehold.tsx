import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import AuthShell from '../components/AuthShell'
import { useT } from '../i18n/LanguageProvider'

/**
 * Landing page for an invite link (`/join/:code`). Completes the join for the
 * signed-in user, then drops them into the shared household. Reached only while
 * authenticated (ProtectedRoute sends anonymous visitors through login first).
 */
export default function JoinHousehold() {
  const { code = '' } = useParams()
  const { joinHousehold } = useAuth()
  const t = useT()
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return // guard against StrictMode double-invoke
    ranRef.current = true
    joinHousehold(code)
      .then(() => navigate('/', { replace: true }))
      .catch((err) =>
        setError(errorMessage(err, t('Could not join that household. Check the invite link or code.'))),
      )
  }, [code, joinHousehold, navigate, t])

  return (
    <AuthShell title={t('Joining household')} subtitle={t('Hang tight — adding you to the shared kitchen.')}>
      {error ? (
        <Stack spacing={2}>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" fullWidth onClick={() => navigate('/', { replace: true })}>
            {t('Continue')}
          </Button>
        </Stack>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress />
        </Box>
      )}
    </AuthShell>
  )
}
