import { useState } from 'react'
import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../auth/AuthContext'
import { useNotify } from '../components/SnackbarProvider'
import { errorMessage } from '../api/client'

/** Pull the invite code out of a pasted invite URL, or accept a bare code. */
function extractCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/join\/([^/?#]+)/)
  return match ? match[1] : trimmed
}

export default function Settings() {
  const { user, updateHousehold, joinHousehold } = useAuth()
  const notify = useNotify()

  const [name, setName] = useState(user?.household?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joining, setJoining] = useState(false)

  const trimmed = name.trim()
  const dirty = trimmed !== '' && trimmed !== (user?.household?.name ?? '')

  const inviteLink = user?.household?.inviteCode
    ? `${window.location.origin}/join/${user.household.inviteCode}`
    : ''

  const handleRename = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty) return
    setSaving(true)
    try {
      await updateHousehold(trimmed)
      notify("Settings saved", 'success')
    } catch (err) {
      notify(errorMessage(err, "Could not save household name"), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      notify("Invite link copied", 'success')
    } catch {
      notify("Something went wrong", 'error')
    }
  }

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    const code = extractCode(joinInput)
    if (!code) return
    setJoining(true)
    try {
      await joinHousehold(code)
      setJoinInput('')
      notify("Joined household", 'success')
    } catch (err) {
      notify(errorMessage(err, "Could not join that household. Check the invite link or code."), 'error')
    } finally {
      setJoining(false)
    }
  }

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Manage your household." />

      <Stack spacing={3} sx={{ maxWidth: 520 }}>
        {/* Rename household */}
        <Card variant="outlined">
          <CardContent component="form" onSubmit={handleRename}>
            <Stack spacing={2}>
              <TextField
                label="Household name"
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={!dirty || saving}>
                  Save changes
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Share invite link */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Invite link</Typography>
              <Typography variant="body2" color="text.secondary">
                Share this link so someone can join this household and see the same ingredients, stock, recipes and plan.
              </Typography>
              <TextField
                fullWidth
                value={inviteLink}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Copy link">
                          <IconButton onClick={handleCopy} edge="end" aria-label="Copy link">
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Join another household */}
        <Card variant="outlined">
          <CardContent component="form" onSubmit={handleJoin}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2">Join another household</Typography>
                <Typography variant="body2" color="text.secondary">
                  Paste an invite link (or code) to switch to that household. Your current household's data stays with it.
                </Typography>
              </Box>
              <TextField
                fullWidth
                placeholder="Invite link or code"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
              <Box>
                <Button type="submit" variant="outlined" disabled={!joinInput.trim() || joining}>
                  Join household
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}
