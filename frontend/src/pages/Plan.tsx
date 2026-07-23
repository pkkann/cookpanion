import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import DateField from '../components/DateField'
import { useNotify } from '../components/SnackbarProvider'
import { useT } from '../i18n/LanguageProvider'
import {
  useCreatePlannedMeal,
  useCreateStock,
  useDeletePlannedMeal,
  usePlannedMeals,
  useRecipes,
  useStock,
  useUpdatePlannedMeal,
  useUpdateStock,
} from '../api/hooks'
import type { PlannedMeal, Recipe, StockItem } from '../api/types'
import { errorMessage } from '../api/client'
import { formatQuantity } from '../utils/quantity'
import { addDaysIso, formatWeekdayDate, todayIso } from '../utils/date'
import { planShoppingList } from '../utils/planShoppingList'
import type { PlanBuyItem } from '../utils/planShoppingList'
import { addToStock } from '../utils/stock'
import { useIsMobile } from '../utils/useIsMobile'

export default function Plan() {
  const t = useT()
  const notify = useNotify()
  const isMobile = useIsMobile()

  const { data: plannedMeals, isLoading, isError, error } = usePlannedMeals()
  const { data: recipes } = useRecipes()
  const { data: stock } = useStock()

  const createMut = useCreatePlannedMeal()
  const updateMut = useUpdatePlannedMeal()
  const deleteMut = useDeletePlannedMeal()
  const createStock = useCreateStock()
  const updateStock = useUpdateStock()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PlannedMeal | null>(null)
  const [toDelete, setToDelete] = useState<PlannedMeal | null>(null)

  // form fields
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [date, setDate] = useState('')
  const [servings, setServings] = useState(0)

  const today = todayIso()
  const tomorrow = addDaysIso(today, 1)

  const dateLabel = (iso: string) => {
    if (iso === today) return t('Today')
    if (iso === tomorrow) return t('Tomorrow')
    return formatWeekdayDate(iso)
  }

  // Upcoming meals (today onward), grouped by date in ascending order.
  const groups = useMemo(() => {
    const upcoming = (plannedMeals ?? [])
      .filter((m) => m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    const map = new Map<string, PlannedMeal[]>()
    for (const m of upcoming) {
      const arr = map.get(m.date)
      if (arr) arr.push(m)
      else map.set(m.date, [m])
    }
    return [...map.entries()]
  }, [plannedMeals, today])

  const shopping = useMemo(
    () => planShoppingList(plannedMeals ?? [], stock ?? []),
    [plannedMeals, stock],
  )

  const plannedDates = useMemo(
    () => new Set((plannedMeals ?? []).map((m) => m.date)),
    [plannedMeals],
  )

  const stockById = useMemo(() => {
    const m = new Map<number, StockItem>()
    for (const s of stock ?? []) m.set(s.ingredient.id, s)
    return m
  }, [stock])

  const openAdd = () => {
    setEditing(null)
    setRecipe(null)
    setDate(today)
    setServings(0)
    setDialogOpen(true)
  }

  const openEdit = (meal: PlannedMeal) => {
    setEditing(meal)
    setRecipe(meal.recipe)
    setDate(meal.date)
    setServings(meal.servings)
    setDialogOpen(true)
  }

  const closeDialog = () => setDialogOpen(false)

  const saving = createMut.isPending || updateMut.isPending
  const canSubmit = Boolean(date) && servings >= 1 && (Boolean(editing) || Boolean(recipe))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: { date, servings } })
        notify(t('Plan updated'), 'success')
      } else {
        if (!recipe) return
        await createMut.mutateAsync({ recipeId: recipe.id, date, servings })
        notify(t('Added to your plan'), 'success')
      }
      closeDialog()
    } catch (err) {
      notify(errorMessage(err, t('Could not save planned meal')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify(t('Removed from plan'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('Could not remove planned meal')), 'error')
    }
  }

  const stockBusy = createStock.isPending || updateStock.isPending

  const addOne = (item: PlanBuyItem) =>
    addToStock(
      { ingredientId: item.ingredientId, quantity: item.shortfall, unit: item.unit },
      stockById,
      { createStock: createStock.mutateAsync, updateStock: updateStock.mutateAsync },
    )

  const handleAddToKitchen = async (item: PlanBuyItem) => {
    try {
      await addOne(item)
      notify(t('Added {name} to your kitchen', { name: item.name }), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not save stock')), 'error')
    }
  }

  const handleAddAllToKitchen = async () => {
    try {
      for (const item of shopping.toBuy) {
        await addOne(item)
      }
      notify(t('Added everything to your kitchen'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('Could not save stock')), 'error')
    }
  }

  return (
    <Box>
      <PageHeader
        title={t('Meal plan')}
        subtitle={t('Plan what to cook and see what you need to buy.')}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            {t('Plan a meal')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('Failed to load your plan'))}
        </Alert>
      )}

      {isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={72} />
          ))}
        </Stack>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CalendarMonthIcon fontSize="inherit" />}
          title={t('Nothing planned yet')}
          description={t('Plan a recipe for a day to start building your shopping list.')}
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
              {t('Plan a meal')}
            </Button>
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' },
            alignItems: 'start',
          }}
        >
          {/* Upcoming meals grouped by date */}
          <Stack spacing={2}>
            {groups.map(([groupDate, meals]) => (
              <Box key={groupDate}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {dateLabel(groupDate)}
                </Typography>
                <Stack spacing={1}>
                  {meals.map((meal) => (
                    <Card key={meal.id} variant="outlined">
                      <CardContent
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          '&:last-child': { pb: 2 },
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Link
                            component={RouterLink}
                            to={`/recipes/${meal.recipe.id}`}
                            variant="subtitle1"
                            sx={{ fontWeight: 600 }}
                            underline="hover"
                            color="inherit"
                          >
                            {meal.recipe.title}
                          </Link>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={meal.servings === 1 ? t('1 serving') : t('{count} servings', { count: meal.servings })}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          <IconButton
                            size="small"
                            aria-label={t('edit')}
                            onClick={() => openEdit(meal)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={t('delete')}
                            color="error"
                            onClick={() => setToDelete(meal)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>

          {/* Shopping list for the plan */}
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <ShoppingCartIcon fontSize="small" /> {t('To buy for this plan')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {t("Across your upcoming meals, minus what's already in your kitchen.")}
            </Typography>

            {shopping.toBuy.length === 0 ? (
              <Alert severity="success" sx={{ py: 0.25 }}>
                {t('You have everything you need for your planned meals.')}
              </Alert>
            ) : (
              <>
                <Stack spacing={0.25} sx={{ mb: 1.5 }}>
                  {shopping.toBuy.map((item) => (
                    <Stack
                      key={`${item.ingredientId}-${item.unit}`}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography variant="body2">
                        {`${item.name} — ${formatQuantity(item.shortfall)} ${item.unit}`.trim()}
                      </Typography>
                      <Tooltip title={t('Add to kitchen')}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={stockBusy}
                            aria-label={t('Add to kitchen')}
                            onClick={() => handleAddToKitchen(item)}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={stockBusy}
                  onClick={handleAddAllToKitchen}
                  sx={{ mt: 0.5 }}
                >
                  {t('Add all to kitchen')}
                </Button>
              </>
            )}

            {shopping.unknown.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                {t('Check manually (unit differs from your kitchen): {names}', {
                  names: shopping.unknown.map((u) => u.name).join(', '),
                })}
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      {/* Plan / edit dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editing ? t('Edit planned meal') : t('Plan a meal')}</DialogTitle>
          <DialogContent>
            {editing ? (
              <TextField
                label={t('Recipe')}
                fullWidth
                margin="normal"
                value={editing.recipe.title}
                disabled
              />
            ) : (
              <Autocomplete
                options={recipes ?? []}
                getOptionLabel={(o) => o.title}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={recipe}
                onChange={(_e, val) => {
                  setRecipe(val)
                  // Default the servings to the recipe's own count until the user overrides it.
                  if (val && servings < 1) setServings(Math.max(1, val.servings))
                }}
                noOptionsText={t('You have no recipes yet. Create one first.')}
                renderInput={(params) => (
                  <TextField {...params} label={t('Recipe')} required margin="normal" autoFocus />
                )}
              />
            )}

            <DateField
              label={t('Date')}
              value={date}
              onChange={setDate}
              fullWidth
              required
              margin="normal"
              markedDates={plannedDates}
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('Servings')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  size="small"
                  aria-label={t('decrease servings')}
                  onClick={() => setServings((n) => Math.max(1, n - 1))}
                  disabled={servings <= 1}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <TextField
                  type="number"
                  size="small"
                  value={servings || ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    setServings(Number.isNaN(n) ? 0 : Math.max(1, n))
                  }}
                  slotProps={{ htmlInput: { min: 1, step: 1, style: { textAlign: 'center', width: 48 } } }}
                />
                <IconButton
                  size="small"
                  aria-label={t('increase servings')}
                  onClick={() => setServings((n) => Math.max(1, n + 1))}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
              {recipe && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {t('This recipe serves {count}.', { count: recipe.servings })}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !canSubmit}>
              {editing ? t('Save changes') : t('Add')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('Remove from plan?')}
        message={t('“{title}” on {date} will be removed from your plan.', {
          title: toDelete?.recipe.title ?? '',
          date: toDelete ? dateLabel(toDelete.date) : '',
        })}
        confirmLabel={t('Remove')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
