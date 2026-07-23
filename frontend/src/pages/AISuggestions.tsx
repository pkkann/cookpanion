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
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
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

export default function AISuggestions() {
  const notify = useNotify()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const queryClient = useQueryClient()
  const { data: ingredients } = useIngredients()

  const [mode, setMode] = useState<SuggestMode>('kitchen')
  const [count, setCount] = useState(3)
  const [maxToBuy, setMaxToBuy] = useState(3)
  const [numIngredients, setNumIngredients] = useState(6)
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
        count,
        maxToBuy,
        numIngredients,
        preferences: preferences.trim() || undefined,
      })
      setSuggestions(res.suggestions)
    } catch (err) {
      if (errorStatus(err) === 503) {
        setNotConfigured(true)
      } else {
        setErrorText(errorMessage(err, "Could not get suggestions"))
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

      // A recipe needs ALL of its ingredients: the ones the household already
      // has (`usesIngredients`) and the ones it still needs to buy (`toBuy`).
      // Missing ingredients are created on the fly so the recipe is complete.
      for (const used of [...suggestion.usesIngredients, ...suggestion.toBuy]) {
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
      notify(`Saved “${suggestion.title}” to your recipes`, 'success')
    } catch (err) {
      notify(errorMessage(err, "Could not save recipe"), 'error')
    } finally {
      setSavingIndex(null)
    }
  }

  return (
    <Box>
      <PageHeader title="AI Suggestions" subtitle="Let Claude suggest recipes from what you have (and a short shopping list)." />

      {/* Request form */}
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="subtitle2" gutterBottom>
            What should we cook with?
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            orientation={isDesktop ? 'horizontal' : 'vertical'}
            fullWidth={!isDesktop}
            onChange={(_e, val: SuggestMode | null) => val && setMode(val)}
            sx={{ mb: 3 }}
          >
            <ToggleButton value="kitchen" sx={{ px: 2, justifyContent: { xs: 'flex-start', md: 'center' } }}>
              <KitchenIcon fontSize="small" sx={{ mr: 1 }} />
              Only my kitchen stock
            </ToggleButton>
            <ToggleButton value="all" sx={{ px: 2, justifyContent: { xs: 'flex-start', md: 'center' } }}>
              <LocalDiningIcon fontSize="small" sx={{ mr: 1 }} />
              All my ingredients
            </ToggleButton>
            <ToggleButton value="surprise" sx={{ px: 2, justifyContent: { xs: 'flex-start', md: 'center' } }}>
              <AutoAwesomeIcon fontSize="small" sx={{ mr: 1 }} />
              Surprise me
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ maxWidth: 420, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              How many recipes: <strong>{count}</strong>
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
              Number of recipe ideas to generate.
            </Typography>
          </Box>

          {mode === 'surprise' ? (
            <Box sx={{ maxWidth: 420, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Max ingredients per recipe: <strong>{numIngredients}</strong>
              </Typography>
              <Slider
                value={numIngredients}
                onChange={(_e, val) => setNumIngredients(val as number)}
                min={3}
                max={15}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Each recipe uses at most this many ingredients. Ignores your kitchen entirely.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxWidth: 420, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Max extra ingredients to buy: <strong>{maxToBuy}</strong>
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
                0 means suggestions must only use what you already have.
              </Typography>
            </Box>
          )}

          <TextField
            label="Preferences (optional)"
            fullWidth
            margin="normal"
            placeholder="e.g. vegetarian, quick, low-carb, kid-friendly"
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
            {loading ? "Thinking…" : "Suggest recipes"}
          </Button>
        </Box>
      </Paper>

      {/* AI not configured (503) */}
      {notConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>AI is not configured yet</AlertTitle>
          {"Recipe suggestions need an Anthropic API key (ANTHROPIC_API_KEY) on the backend. Once it's added, come back and try again — the rest of the app works without it."}
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
          <Typography color="text.secondary">Cooking up some ideas…</Typography>
        </Box>
      )}

      {/* Empty result */}
      {!loading && suggestions?.length === 0 && (
        <Alert severity="info">No suggestions came back. Try allowing a few more ingredients to buy, or switch to using all your ingredients.</Alert>
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
                  label={s.servings === 1 ? `${s.servings} serving` : `${s.servings} servings`}
                  sx={{ mb: 1.5 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {s.description}
                </Typography>

                <Typography variant="subtitle2" gutterBottom>
                  Uses
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
                      <ShoppingCartIcon fontSize="small" /> To buy
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
                  Instructions
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
                    ? "Saved"
                    : savingIndex === i
                      ? "Saving…"
                      : "Save as recipe"}
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  )
}
