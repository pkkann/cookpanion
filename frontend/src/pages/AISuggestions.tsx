import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import CircularProgress from '@mui/material/CircularProgress'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import KitchenIcon from '@mui/icons-material/Kitchen'
import LocalDiningIcon from '@mui/icons-material/LocalDining'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PeopleIcon from '@mui/icons-material/People'
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'
import PageHeader from '../components/PageHeader'
import { useNotify } from '../components/SnackbarProvider'
import { useIngredients } from '../api/hooks'
import { queryKeys } from '../api/hooks'
import { createIngredient, createRecipe, suggestRecipes } from '../api/endpoints'
import { errorMessage, errorStatus } from '../api/client'
import type {
  Ingredient,
  RecipeIngredientPayload,
  RecipeSuggestion,
  SuggestMode,
} from '../api/types'
import { useTranslation } from 'react-i18next'

export default function AISuggestions() {
  const { t } = useTranslation(['suggestions', 'errors'])
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { data: ingredients } = useIngredients()

  const [mode, setMode] = useState<SuggestMode>('kitchen')
  const [maxToBuy, setMaxToBuy] = useState(3)
  const [preferences, setPreferences] = useState('')

  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[] | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set())

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setNotConfigured(false)
    setErrorText(null)
    setSuggestions(null)
    setSavedIndexes(new Set())
    try {
      const res = await suggestRecipes({
        mode,
        maxToBuy,
        preferences: preferences.trim() || undefined,
      })
      setSuggestions(res.suggestions)
    } catch (err) {
      if (errorStatus(err) === 503) {
        setNotConfigured(true)
      } else {
        setErrorText(errorMessage(err, t('errors:suggestions')))
      }
    } finally {
      setLoading(false)
    }
  }

  // Map suggestion ingredients to existing ones by name (case-insensitive),
  // creating any that don't exist yet, then create a real recipe.
  const saveAsRecipe = async (suggestion: RecipeSuggestion, index: number) => {
    setSavingIndex(index)
    try {
      const byName = new Map<string, Ingredient>()
      for (const ing of ingredients ?? []) {
        byName.set(ing.name.trim().toLowerCase(), ing)
      }

      const recipeIngredients: RecipeIngredientPayload[] = []
      let createdAny = false

      for (const used of suggestion.usesIngredients) {
        const key = used.name.trim().toLowerCase()
        let ingredient = byName.get(key)
        if (!ingredient) {
          ingredient = await createIngredient({
            name: used.name.trim(),
            defaultUnit: used.unit || null,
          })
          byName.set(key, ingredient)
          createdAny = true
        }
        recipeIngredients.push({
          ingredientId: ingredient.id,
          quantity: used.quantity,
          unit: used.unit,
        })
      }

      await createRecipe({
        title: suggestion.title,
        description: suggestion.description,
        instructions: suggestion.instructions,
        servings: suggestion.servings,
        ingredients: recipeIngredients,
      })

      if (createdAny) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ingredients })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes })

      setSavedIndexes((prev) => new Set(prev).add(index))
      notify(t('savedToast', { title: suggestion.title }), 'success')
    } catch (err) {
      notify(errorMessage(err, t('errors:saveRecipe')), 'error')
    } finally {
      setSavingIndex(null)
    }
  }

  return (
    <Box>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Request form */}
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="subtitle2" gutterBottom>
            {t('whatToCook')}
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_e, val: SuggestMode | null) => val && setMode(val)}
            sx={{ mb: 3, flexWrap: 'wrap' }}
          >
            <ToggleButton value="kitchen" sx={{ px: 2 }}>
              <KitchenIcon fontSize="small" sx={{ mr: 1 }} />
              {t('onlyKitchen')}
            </ToggleButton>
            <ToggleButton value="all" sx={{ px: 2 }}>
              <LocalDiningIcon fontSize="small" sx={{ mr: 1 }} />
              {t('allIngredients')}
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ maxWidth: 420, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('maxToBuy')} <strong>{maxToBuy}</strong>
            </Typography>
            <Slider
              value={maxToBuy}
              onChange={(_e, val) => setMaxToBuy(val as number)}
              min={0}
              max={10}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              {t('maxToBuyHint')}
            </Typography>
          </Box>

          <TextField
            label={t('preferences')}
            fullWidth
            margin="normal"
            placeholder={t('preferencesPlaceholder')}
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? t('thinking') : t('suggestRecipes')}
          </Button>
        </Box>
      </Paper>

      {/* AI not configured (503) */}
      {notConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>{t('notConfiguredTitle')}</AlertTitle>
          {t('notConfiguredBody')}
        </Alert>
      )}

      {errorText && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorText}
        </Alert>
      )}

      {/* Loading placeholder */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
          <CircularProgress />
          <Typography color="text.secondary">{t('cooking')}</Typography>
        </Box>
      )}

      {/* Empty result */}
      {!loading && suggestions?.length === 0 && (
        <Alert severity="info">{t('emptyResult')}</Alert>
      )}

      {/* Suggestions */}
      {!loading && suggestions && suggestions.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          }}
        >
          {suggestions.map((s, i) => (
            <Card key={`${s.title}-${i}`} sx={{ display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {s.title}
                </Typography>
                <Chip
                  size="small"
                  icon={<PeopleIcon />}
                  label={t('servings', { count: s.servings })}
                  sx={{ mb: 1.5 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {s.description}
                </Typography>

                <Typography variant="subtitle2" gutterBottom>
                  {t('uses')}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
                  {s.usesIngredients.map((u, ui) => (
                    <Chip
                      key={`use-${ui}`}
                      size="small"
                      label={`${u.name} · ${u.quantity} ${u.unit}`}
                    />
                  ))}
                </Stack>

                {s.toBuy.length > 0 && (
                  <>
                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <ShoppingCartIcon fontSize="small" /> {t('toBuy')}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
                      {s.toBuy.map((b, bi) => (
                        <Chip
                          key={`buy-${bi}`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          label={`${b.name} · ${b.quantity} ${b.unit}`}
                        />
                      ))}
                    </Stack>
                  </>
                )}

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" gutterBottom>
                  {t('instructions')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                >
                  {s.instructions}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<BookmarkAddIcon />}
                  disabled={savingIndex === i || savedIndexes.has(i)}
                  onClick={() => saveAsRecipe(s, i)}
                >
                  {savedIndexes.has(i)
                    ? t('saved')
                    : savingIndex === i
                      ? t('saving')
                      : t('saveAsRecipe')}
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  )
}
