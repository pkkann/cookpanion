import { useState } from 'react'
import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import TranslateIcon from '@mui/icons-material/Translate'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../auth/AuthContext'
import { useNotify } from '../components/SnackbarProvider'
import { useRetranslateContent } from '../api/hooks'
import { errorMessage } from '../api/client'
import { useAiEnabled } from '../api/config'
import { useLanguage, useT } from '../i18n/LanguageProvider'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../i18n/strings'
import type { Language } from '../i18n/strings'
import { setPassword as setPasswordRequest } from '../api/endpoints'

const MIN_PASSWORD_LENGTH = 6

/** Pull the invite code out of a pasted invite URL, or accept a bare code. */
function extractCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/join\/([^/?#]+)/)
  return match ? match[1] : trimmed
}

export default function Settings() {
  const { user, updateHousehold, setHouseholdLanguage, setUserLanguage, joinHousehold } = useAuth()
  const { lang } = useLanguage()
  const t = useT()
  const notify = useNotify()
  const aiEnabled = useAiEnabled()

  const [name, setName] = useState(user?.household?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [languageSaving, setLanguageSaving] = useState(false)
  const [displaySaving, setDisplaySaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const handleDisplayLanguage = async (next: Language) => {
    if (next === lang) return
    setDisplaySaving(true)
    try {
      await setUserLanguage(next)
      notify(t('Settings saved'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not save settings')), 'error')
    } finally {
      setDisplaySaving(false)
    }
  }
  const [retranslateOpen, setRetranslateOpen] = useState(false)
  const retranslateMut = useRetranslateContent()

  const contentLanguage: Language = user?.household?.language ?? 'en'

  const handleContentLanguage = async (next: Language) => {
    if (next === contentLanguage) return
    setLanguageSaving(true)
    try {
      await setHouseholdLanguage(next)
      notify(t('Settings saved'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not save settings')), 'error')
    } finally {
      setLanguageSaving(false)
    }
  }

  const handleRetranslate = async () => {
    try {
      const res = await retranslateMut.mutateAsync()
      setRetranslateOpen(false)
      notify(
        t('Translated {recipes} recipes and {ingredients} ingredients.', {
          recipes: res.recipes,
          ingredients: res.ingredients,
        }),
        'success',
      )
    } catch (err) {
      notify(errorMessage(err, t('Could not translate your content.')), 'error')
    }
  }

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
      notify(t('Settings saved'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not save household name')), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      notify(t('Invite link copied'), 'success')
    } catch {
      notify(t('Something went wrong'), 'error')
    }
  }

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      notify(t('Password must be at least 6 characters.'), 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      notify(t('Passwords do not match'), 'error')
      return
    }
    setPasswordSaving(true)
    try {
      await setPasswordRequest(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      notify(t('Password saved'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not save password')), 'error')
    } finally {
      setPasswordSaving(false)
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
      notify(t('Joined household'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not join that household. Check the invite link or code.')), 'error')
    } finally {
      setJoining(false)
    }
  }

  return (
    <Box>
      <PageHeader title={t('Settings')} subtitle={t('Manage your household.')} />

      <Stack spacing={3} sx={{ maxWidth: 520 }}>
        {/* Language */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2">{t('Language')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'Set how the app appears for you, and the language new recipes, ingredients and AI suggestions are written in.',
                  )}
                </Typography>
              </Box>
              <TextField
                select
                label={t('Display language')}
                value={lang}
                disabled={displaySaving}
                onChange={(e) => handleDisplayLanguage(e.target.value as Language)}
                helperText={t('Applies to your account, on every device.')}
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <MenuItem key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('Recipe & AI language')}
                value={contentLanguage}
                disabled={languageSaving}
                onChange={(e) => handleContentLanguage(e.target.value as Language)}
                helperText={t("New recipes, ingredients and AI content use this. Existing items aren't changed.")}
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <MenuItem key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </MenuItem>
                ))}
              </TextField>
              {aiEnabled && (
                <Box>
                  <Button
                    variant="outlined"
                    disabled={retranslateMut.isPending}
                    startIcon={
                      retranslateMut.isPending ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <TranslateIcon />
                      )
                    }
                    onClick={() => setRetranslateOpen(true)}
                  >
                    {retranslateMut.isPending
                      ? t('Translating…')
                      : t('Re-translate existing content')}
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {t(
                      'Rewrites all existing recipes and ingredient names into the selected recipe language using AI.',
                    )}
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Rename household */}
        <Card variant="outlined">
          <CardContent component="form" onSubmit={handleRename}>
            <Stack spacing={2}>
              <TextField
                label={t('Household name')}
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={!dirty || saving}>
                  {t('Save changes')}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Password */}
        <Card variant="outlined">
          <CardContent component="form" onSubmit={handleSetPassword}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2">{t('Password')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'Set a password to sign in with your email instead of Google. Useful when Google sign-in is unavailable.',
                  )}
                </Typography>
              </Box>
              <TextField
                label={t('New password')}
                type="password"
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                helperText={t('At least 6 characters.')}
              />
              <TextField
                label={t('Confirm password')}
                type="password"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!newPassword || !confirmPassword || passwordSaving}
                >
                  {t('Save password')}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Share invite link */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2">{t('Invite link')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'Share this link so someone can join this household and see the same ingredients, stock, recipes and plan.',
                )}
              </Typography>
              <TextField
                fullWidth
                value={inviteLink}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={t('Copy link')}>
                          <IconButton onClick={handleCopy} edge="end" aria-label={t('Copy link')}>
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
                <Typography variant="subtitle2">{t('Join another household')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    "Paste an invite link (or code) to switch to that household. Your current household's data stays with it.",
                  )}
                </Typography>
              </Box>
              <TextField
                fullWidth
                placeholder={t('Invite link or code')}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
              <Box>
                <Button type="submit" variant="outlined" disabled={!joinInput.trim() || joining}>
                  {t('Join household')}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <ConfirmDialog
        open={retranslateOpen}
        title={t('Re-translate everything?')}
        message={t(
          'This rewrites every recipe and ingredient name into {language} using AI. It can take a moment and overwrites the current text.',
          { language: LANGUAGE_LABELS[contentLanguage] },
        )}
        confirmLabel={t('Translate')}
        loading={retranslateMut.isPending}
        onConfirm={handleRetranslate}
        onCancel={() => setRetranslateOpen(false)}
      />
    </Box>
  )
}
