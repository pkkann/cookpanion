import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import MenuItem from '@mui/material/MenuItem'
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
import LocalDiningIcon from '@mui/icons-material/LocalDining'
import PeopleIcon from '@mui/icons-material/People'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'
import PageHeader from '../components/PageHeader'
import { useNotify } from '../components/SnackbarProvider'
import { useT } from '../i18n/LanguageProvider'
import { useUnitLabel } from '../i18n/unitLabels'
import { useIngredients } from '../api/hooks'
import { queryKeys } from '../api/hooks'
import { createIngredient, createRecipe, suggestRecipes } from '../api/endpoints'
import { errorMessage, errorStatus } from '../api/client'
import { useFormatDuration, useFormatPrepCook } from '../utils/time'
import type { Ingredient, RecipeIngredientPayload, RecipeSuggestion } from '../api/types'

// Selectable ceilings for a recipe's total (prep + cook) time. 0 = no limit.
const MAX_TIME_OPTIONS = [0, 15, 30, 45, 60, 90, 120]

export default function AISuggestions() {
  const t = useT()
  const unitOf = useUnitLabel()
  const duration = useFormatDuration()
  const prepCook = useFormatPrepCook()
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { data: ingredients } = useIngredients()

  const [count, setCount] = useState(3)
  const [servings, setServings] = useState(2)
  const [maxTimeMinutes, setMaxTimeMinutes] = useState(0)
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
        count,
        servings,
        maxTimeMinutes,
        preferences: preferences.trim() || undefined,
      })
      setSuggestions(res.suggestions)
    } catch (err) {
      if (errorStatus(err) === 503) {
        setNotConfigured(true)
      } else {
        setErrorText(errorMessage(err, t("Could not get suggestions")))
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

      // Ingredients the household doesn't know yet are created on the fly so
      // the saved recipe is complete.
      for (const used of suggestion.ingredients) {
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
        prepTimeMinutes: suggestion.prepTimeMinutes || null,
        cookTimeMinutes: suggestion.cookTimeMinutes || null,
        ingredients: recipeIngredients,
      })

      if (createdAny) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ingredients })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes })

      setSavedIndexes((prev) => new Set(prev).add(index))
      notify(t('Saved “{title}” to your recipes', { title: suggestion.title }), 'success')
    } catch (err) {
      notify(errorMessage(err, t("Could not save recipe")), 'error')
    } finally {
      setSavingIndex(null)
    }
  }

  return (
    <Box>
      <PageHeader
        title={t('AI Suggestions')}
        subtitle={t("Recipe ideas tuned to your household's taste and preferences.")}
      />

      {/* Request form */}
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ maxWidth: 420, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('How many recipes:')} <strong>{count}</strong>
            </Typography>
            <Slider
              value={count}
              onChange={(_e, val) => setCount(val as number)}
              min={1}
              max={6}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              {t('Number of recipe ideas to generate.')}
            </Typography>
          </Box>

          <Box sx={{ maxWidth: 420, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('Servings per recipe:')} <strong>{servings}</strong>
            </Typography>
            <Slider
              value={servings}
              onChange={(_e, val) => setServings(val as number)}
              min={1}
              max={12}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              {t('Every suggestion is sized for this many people.')}
            </Typography>
          </Box>

          <TextField
            select
            label={t('Max total time')}
            value={maxTimeMinutes}
            onChange={(e) => setMaxTimeMinutes(Number(e.target.value))}
            sx={{ maxWidth: 420, mb: 2 }}
            fullWidth
            helperText={t('Cap on prep + cook time for each recipe.')}
          >
            {MAX_TIME_OPTIONS.map((minutes) => (
              <MenuItem key={minutes} value={minutes}>
                {minutes === 0 ? t('No limit') : duration(minutes)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('Preferences (optional)')}
            fullWidth
            margin="normal"
            placeholder={t('e.g. vegetarian, quick, low-carb, kid-friendly')}
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
            {loading ? t("Thinking…") : t("Suggest recipes")}
          </Button>
        </Box>
      </Paper>

      {/* AI not configured (503) */}
      {notConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>{t('AI is not configured yet')}</AlertTitle>
          {t("Recipe suggestions need an Anthropic API key (ANTHROPIC_API_KEY) on the backend. Once it's added, come back and try again — the rest of the app works without it.")}
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
          <Typography color="text.secondary">{t('Cooking up some ideas…')}</Typography>
        </Box>
      )}

      {/* Empty result */}
      {!loading && suggestions?.length === 0 && (
        <Alert severity="info">{t('No suggestions came back. Try again, or loosen the time limit.')}</Alert>
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
                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    icon={<PeopleIcon />}
                    label={s.servings === 1 ? t('{count} serving', { count: s.servings }) : t('{count} servings', { count: s.servings })}
                  />
                  {prepCook(s.prepTimeMinutes, s.cookTimeMinutes) && (
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<AccessTimeIcon />}
                      label={prepCook(s.prepTimeMinutes, s.cookTimeMinutes)}
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {s.description}
                </Typography>

                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <LocalDiningIcon fontSize="small" /> {t('Ingredients')}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
                  {s.ingredients.map((ing, ii) => (
                    <Chip
                      key={`ing-${ii}`}
                      size="small"
                      label={`${ing.name} · ${ing.quantity} ${unitOf(ing.unit)}`}
                    />
                  ))}
                </Stack>

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" gutterBottom>
                  {t('Instructions')}
                </Typography>
                <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
                  {s.instructions.map((step, si) => (
                    <Typography
                      key={si}
                      component="li"
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      {step}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<BookmarkAddIcon />}
                  disabled={savingIndex === i || savedIndexes.has(i)}
                  onClick={() => saveAsRecipe(s, i)}
                >
                  {savedIndexes.has(i)
                    ? t("Saved")
                    : savingIndex === i
                      ? t("Saving…")
                      : t("Save as recipe")}
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  )
}
