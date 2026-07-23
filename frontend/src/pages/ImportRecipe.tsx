import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import CircularProgress from '@mui/material/CircularProgress'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LinkIcon from '@mui/icons-material/Link'
import NotesIcon from '@mui/icons-material/Notes'
import PageHeader from '../components/PageHeader'
import RecipeFormDialog from '../components/RecipeFormDialog'
import { useImportRecipe } from '../api/hooks'
import { errorMessage, errorStatus } from '../api/client'
import type { ImportedRecipe } from '../api/types'

type Source = 'link' | 'text'

export default function ImportRecipe() {
  const navigate = useNavigate()
  const importMut = useImportRecipe()

  const [source, setSource] = useState<Source>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')

  const [notConfigured, setNotConfigured] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [draft, setDraft] = useState<ImportedRecipe | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loading = importMut.isPending
  const canSubmit = source === 'link' ? url.trim() !== '' : text.trim() !== ''

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setNotConfigured(false)
    setErrorText(null)
    try {
      const recipe = await importMut.mutateAsync(
        source === 'link' ? { url: url.trim() } : { text: text.trim() },
      )
      setDraft(recipe)
      setDialogOpen(true)
    } catch (err) {
      if (errorStatus(err) === 503) {
        setNotConfigured(true)
      } else {
        setErrorText(errorMessage(err, 'Could not import that recipe.'))
      }
    }
  }

  return (
    <Box>
      <PageHeader
        title="Import recipe"
        subtitle="Paste a link to a recipe page or paste the recipe text, and Claude will turn it into a recipe (always in English)."
      />

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <ToggleButtonGroup
            value={source}
            exclusive
            onChange={(_e, val: Source | null) => val && setSource(val)}
            sx={{ mb: 3 }}
          >
            <ToggleButton value="link" sx={{ px: 2 }}>
              <LinkIcon fontSize="small" sx={{ mr: 1 }} />
              From a link
            </ToggleButton>
            <ToggleButton value="text" sx={{ px: 2 }}>
              <NotesIcon fontSize="small" sx={{ mr: 1 }} />
              Paste text
            </ToggleButton>
          </ToggleButtonGroup>

          {source === 'link' ? (
            <TextField
              label="Recipe URL"
              type="url"
              fullWidth
              placeholder="https://example.com/best-lasagna"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              helperText="We'll fetch the page and pull out the recipe."
            />
          ) : (
            <TextField
              label="Recipe text"
              fullWidth
              multiline
              minRows={8}
              placeholder="Paste the full recipe here — title, ingredients and steps."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            disabled={loading || !canSubmit}
            sx={{ mt: 2 }}
          >
            {loading ? 'Reading…' : 'Import with AI'}
          </Button>
        </Box>
      </Paper>

      {notConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>AI is not configured yet</AlertTitle>
          {"Recipe import needs an Anthropic API key (ANTHROPIC_API_KEY) on the backend. Once it's added, come back and try again."}
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
