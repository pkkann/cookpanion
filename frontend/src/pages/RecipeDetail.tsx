import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import PeopleIcon from '@mui/icons-material/People'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ConfirmDialog from '../components/ConfirmDialog'
import RecipeFormDialog from '../components/RecipeFormDialog'
import QuickPlanButton from '../components/QuickPlanButton'
import { useNotify } from '../components/SnackbarProvider'
import { useT } from '../i18n/LanguageProvider'
import { useUnitLabel } from '../i18n/unitLabels'
import { useDeleteRecipe, useRecipe } from '../api/hooks'
import { errorMessage } from '../api/client'
import { formatQuantity, scaleQuantity } from '../utils/quantity'
import { useIsMobile } from '../utils/useIsMobile'
import { useFormatPrepCook } from '../utils/time'

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const notify = useNotify()
  const isMobile = useIsMobile()
  const t = useT()
  const u = useUnitLabel()
  const prepCook = useFormatPrepCook()

  const { data: recipe, isLoading, isError, error } = useRecipe(recipeId)
  const deleteMut = useDeleteRecipe()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Live, view-only servings scaling. Defaults to the recipe's stored
  // servings, unless the link carries ?servings= — planned meals pass their
  // own serving count so the recipe opens pre-scaled to the plan.
  const [searchParams] = useSearchParams()
  const requestedServings = parseInt(searchParams.get('servings') ?? '', 10)
  const baseServings = recipe?.servings ?? 0
  const canScale = baseServings > 0
  const defaultServings = canScale ? baseServings : 1
  const initialServings =
    Number.isInteger(requestedServings) && requestedServings > 0
      ? requestedServings
      : defaultServings
  const [chosenServings, setChosenServings] = useState(1)

  // Sync the chosen servings to the recipe once it loads / changes.
  useEffect(() => {
    setChosenServings(initialServings)
  }, [recipe?.id, initialServings])

  const isScaled = canScale && chosenServings !== baseServings

  const decrement = () => setChosenServings((n) => Math.max(1, n - 1))
  const increment = () => setChosenServings((n) => n + 1)
  const reset = () => setChosenServings(defaultServings)
  const onServingsInput = (e: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    setChosenServings(Number.isNaN(parsed) ? 1 : Math.max(1, parsed))
  }

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(recipeId)
      notify(t('Recipe deleted'), 'success')
      navigate('/recipes')
    } catch (err) {
      notify(errorMessage(err, t('Could not delete recipe')), 'error')
    }
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/recipes')} sx={{ mb: 2 }}>
        {t('Back to recipes')}
      </Button>

      {isError && (
        <Alert severity="error">{errorMessage(error, t('Failed to load recipe'))}</Alert>
      )}

      {isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="text" width="50%" height={48} />
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={240} />
        </Stack>
      ) : recipe ? (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h4" component="h1">
                {recipe.title}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  icon={<PeopleIcon />}
                  variant="outlined"
                  label={t('serves {count} by default', { count: recipe.servings })}
                />
                <Chip
                  variant="outlined"
                  label={t('by {author}', { author: recipe.author?.name ?? t('Unknown') })}
                />
                {prepCook(recipe.prepTimeMinutes, recipe.cookTimeMinutes) && (
                  <Chip
                    icon={<AccessTimeIcon />}
                    variant="outlined"
                    label={prepCook(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                  />
                )}
              </Stack>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              <QuickPlanButton
                recipe={recipe}
                variant="button"
                fullWidth={isMobile}
                servings={chosenServings}
              />
              <Button
                variant="outlined"
                fullWidth={isMobile}
                startIcon={<EditIcon />}
                onClick={() => setEditOpen(true)}
              >
                {t('Edit')}
              </Button>
              <Button
                variant="outlined"
                fullWidth={isMobile}
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmOpen(true)}
              >
                {t('Delete')}
              </Button>
            </Stack>
          </Box>

          {recipe.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {recipe.description}
            </Typography>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' },
              alignItems: 'start',
            }}
          >
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography variant="h6">{t('Ingredients')}</Typography>
                {/* Servings stepper — recalculates quantities live */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    aria-label={t('decrease servings')}
                    onClick={decrement}
                    disabled={chosenServings <= 1}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    value={chosenServings}
                    onChange={onServingsInput}
                    type="number"
                    size="small"
                    aria-label={t('servings')}
                    slotProps={{
                      htmlInput: {
                        min: 1,
                        step: 1,
                        style: { textAlign: 'center', width: 40 },
                      },
                    }}
                  />
                  <IconButton
                    size="small"
                    aria-label={t('increase servings')}
                    onClick={increment}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                    {chosenServings === 1 ? t('serving') : t('servings')}
                  </Typography>
                </Box>
              </Box>

              {/* Scaling hint / reset affordance */}
              {isScaled ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={
                      chosenServings === 1
                        ? t('Scaled for {count} serving', { count: chosenServings })
                        : t('Scaled for {count} servings', { count: chosenServings })
                    }
                  />
                  <Button size="small" startIcon={<RestartAltIcon />} onClick={reset}>
                    {t('Reset')}
                  </Button>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  {canScale
                    ? t('Amounts shown for the default serving size. Adjust to rescale.')
                    : t("This recipe has no serving size set, so quantities can't be scaled.")}
                </Typography>
              )}

              {recipe.ingredients.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('No ingredients listed.')}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {recipe.ingredients.map((ri, idx) => {
                    const needed = scaleQuantity(ri.quantity, baseServings, chosenServings)
                    const qtyLabel = `${formatQuantity(needed)} ${u(ri.unit)}`.trim()
                    return (
                      <ListItem key={`${ri.ingredient.id}-${idx}`} disableGutters>
                        <ListItemText primary={ri.ingredient.name} secondary={qtyLabel} />
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                {t('Instructions')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {recipe.instructions.length > 0 ? (
                <Stack component="ol" spacing={1.5} sx={{ m: 0, pl: 3 }}>
                  {recipe.instructions.map((step, i) => (
                    <Typography key={i} component="li" variant="body1" sx={{ lineHeight: 1.6 }}>
                      {step}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  {t('No instructions provided.')}
                </Typography>
              )}
            </Paper>
          </Box>

          <RecipeFormDialog open={editOpen} recipe={recipe} onClose={() => setEditOpen(false)} />
          <ConfirmDialog
            open={confirmOpen}
            title={t('Delete recipe?')}
            message={t('“{title}” will be permanently deleted, along with any meals planned with it.', {
              title: recipe.title,
            })}
            confirmLabel={t('Delete')}
            destructive
            loading={deleteMut.isPending}
            onConfirm={handleDelete}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      ) : (
        !isError && <Typography>{t('Recipe not found.')}</Typography>
      )}
    </Box>
  )
}
