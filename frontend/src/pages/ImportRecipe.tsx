import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import CircularProgress from '@mui/material/CircularProgress'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LinkIcon from '@mui/icons-material/Link'
import NotesIcon from '@mui/icons-material/Notes'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import PageHeader from '../components/PageHeader'
import RecipeFormDialog from '../components/RecipeFormDialog'
import { useT } from '../i18n/LanguageProvider'
import { useImportRecipe } from '../api/hooks'
import { errorMessage, errorStatus } from '../api/client'
import { fileToDownscaledJpeg } from '../utils/image'
import type { ImportedRecipe, ImportRecipePayload } from '../api/types'

type Source = 'link' | 'text' | 'photo'

export default function ImportRecipe() {
  const t = useT()
  const navigate = useNavigate()
  const importMut = useImportRecipe()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [source, setSource] = useState<Source>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [preparingImage, setPreparingImage] = useState(false)

  const [notConfigured, setNotConfigured] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [draft, setDraft] = useState<ImportedRecipe | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loading = importMut.isPending
  const canSubmit =
    source === 'link' ? url.trim() !== '' : source === 'text' ? text.trim() !== '' : image !== null

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file again re-triggers onChange.
    e.target.value = ''
    if (!file) return
    setErrorText(null)
    setPreparingImage(true)
    try {
      setImage(await fileToDownscaledJpeg(file))
    } catch {
      setErrorText(t('Could not read that image. Try a different photo.'))
    } finally {
      setPreparingImage(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setNotConfigured(false)
    setErrorText(null)
    const payload: ImportRecipePayload =
      source === 'link'
        ? { url: url.trim() }
        : source === 'text'
          ? { text: text.trim() }
          : { image: image! }
    try {
      const recipe = await importMut.mutateAsync(payload)
      setDraft(recipe)
      setDialogOpen(true)
    } catch (err) {
      if (errorStatus(err) === 503) {
        setNotConfigured(true)
      } else {
        setErrorText(errorMessage(err, t('Could not import that recipe.')))
      }
    }
  }

  return (
    <Box>
      <PageHeader
        title={t('Import recipe')}
        subtitle={t('Paste a link, paste the recipe text, or snap a photo, and the AI turns it into a recipe.')}
      />

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <ToggleButtonGroup
            value={source}
            exclusive
            onChange={(_e, val: Source | null) => val && setSource(val)}
            sx={{ mb: 3, flexWrap: 'wrap' }}
          >
            <ToggleButton value="link" sx={{ px: 2 }}>
              <LinkIcon fontSize="small" sx={{ mr: 1 }} />
              {t('From a link')}
            </ToggleButton>
            <ToggleButton value="text" sx={{ px: 2 }}>
              <NotesIcon fontSize="small" sx={{ mr: 1 }} />
              {t('Paste text')}
            </ToggleButton>
            <ToggleButton value="photo" sx={{ px: 2 }}>
              <PhotoCameraIcon fontSize="small" sx={{ mr: 1 }} />
              {t('Take a photo')}
            </ToggleButton>
          </ToggleButtonGroup>

          {source === 'link' && (
            <TextField
              label={t('Recipe URL')}
              type="url"
              fullWidth
              placeholder="https://example.com/best-lasagna"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              helperText={t("We'll fetch the page and pull out the recipe.")}
            />
          )}

          {source === 'text' && (
            <TextField
              label={t('Recipe text')}
              fullWidth
              multiline
              minRows={8}
              placeholder={t('Paste the full recipe here — title, ingredients and steps.')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          {source === 'photo' && (
            <Box>
              {/* On phones this opens the camera; on desktop, a file picker. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handleFile}
              />
              <Button
                variant="outlined"
                startIcon={
                  preparingImage ? <CircularProgress size={18} color="inherit" /> : <PhotoCameraIcon />
                }
                disabled={preparingImage}
                onClick={() => fileInputRef.current?.click()}
              >
                {image ? t('Choose a different photo') : t('Take or choose a photo')}
              </Button>
              {image && (
                <Box sx={{ mt: 2 }}>
                  <Box
                    component="img"
                    src={image}
                    alt={t('Recipe to import')}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 320,
                      borderRadius: 1,
                      display: 'block',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                </Box>
              )}
              {!image && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {t('Point the camera at a cookbook page or a written recipe. Handwriting works too.')}
                </Typography>
              )}
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            disabled={loading || !canSubmit}
            sx={{ mt: 2, display: 'block' }}
          >
            {loading ? t('Reading…') : t('Import with AI')}
          </Button>
        </Box>
      </Paper>

      {notConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>{t('AI is not configured yet')}</AlertTitle>
          {t("Recipe import needs an Anthropic API key (ANTHROPIC_API_KEY) on the backend. Once it's added, come back and try again.")}
        </Alert>
      )}

      {errorText && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorText}
        </Alert>
      )}

      {/* Review + edit the extracted recipe before saving. */}
      <RecipeFormDialog
        open={dialogOpen}
        recipe={null}
        draft={draft}
        onClose={() => setDialogOpen(false)}
        onSaved={(recipe) => {
          setDialogOpen(false)
          navigate(`/recipes/${recipe.id}`)
        }}
      />
    </Box>
  )
}
