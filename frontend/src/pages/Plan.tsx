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
import { useNotify } from '../components/SnackbarProvider'
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
import { useTranslation } from 'react-i18next'

export default function Plan() {
  const { t, i18n } = useTranslation(['plan', 'common', 'errors'])
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
    if (iso === today) return t('today')
    if (iso === tomorrow) return t('tomorrow')
    return formatWeekdayDate(iso, i18n.language)
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

  // Group the buy list by ingredient category for a grocery-list feel.
  const buyByCategory = useMemo(() => {
    const map = new Map<string, PlanBuyItem[]>()
    for (const item of shopping.toBuy) {
      const key = item.category ?? ''
      const arr = map.get(key)
      if (arr) arr.push(item)
      else map.set(key, [item])
    }
    return [...map.entries()].sort(([a], [b]) => {
      // Uncategorized ("") sorts last.
      if (a === '') return 1
      if (b === '') return -1
      return a.localeCompare(b)
    })
  }, [shopping])

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
        notify(t('toast.updated'), 'success')
      } else {
        if (!recipe) return
        await createMut.mutateAsync({ recipeId: recipe.id, date, servings })
        notify(t('toast.planned'), 'success')
      }
      closeDialog()
    } catch (err) {
      notify(errorMessage(err, t('errors:savePlannedMeal')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify(t('toast.removed'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('errors:removePlannedMeal')), 'error')
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
      notify(t('toast.addedToKitchen', { name: item.name }), 'success')
    } catch (err) {
      notify(errorMessage(err, t('errors:saveStock')), 'error')
    }
  }

  const handleAddAllToKitchen = async () => {
    try {
      for (const item of shopping.toBuy) {
        await addOne(item)
      }
      notify(t('toast.addedAllToKitchen'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('errors:saveStock')), 'error')
    }
  }

  return (
    <Box>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            {t('planMeal')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('errors:loadPlannedMeals'))}
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
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
              {t('planMeal')}
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
                              label={t('servingsChip', { count: meal.servings })}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          <IconButton
                            size="small"
                            aria-label={t('common:aria.edit')}
                            onClick={() => openEdit(meal)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={t('common:aria.delete')}
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
              <ShoppingCartIcon fontSize="small" /> {t('shoppingTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {t('shoppingSubtitle')}
            </Typography>

            {shopping.toBuy.length === 0 ? (
              <Alert severity="success" sx={{ py: 0.25 }}>
                {t('nothingToBuy')}
              </Alert>
            ) : (
              <>
                {buyByCategory.map(([category, items]) => (
                  <Box key={category || 'uncategorized'} sx={{ mb: 1.5 }}>
                    <Typography variant="overline" color="text.secondary">
                      {category || t('uncategorized')}
                    </Typography>
                    <Stack spacing={0.25}>
                      {items.map((item) => (
                        <Stack
                          key={`${item.ingredientId}-${item.unit}`}
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <Typography variant="body2">
                            {`${item.name} — ${formatQuantity(item.shortfall)} ${item.unit}`.trim()}
                          </Typography>
                          <Tooltip title={t('addToKitchen')}>
                            <span>
                              <IconButton
                                size="small"
                                disabled={stockBusy}
                                aria-label={t('addToKitchen')}
                                onClick={() => handleAddToKitchen(item)}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                ))}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={stockBusy}
                  onClick={handleAddAllToKitchen}
                  sx={{ mt: 0.5 }}
                >
                  {t('addAllToKitchen')}
                </Button>
              </>
            )}

            {shopping.unknown.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                {t('checkManually', { list: shopping.unknown.map((u) => u.name).join(', ') })}
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      {/* Plan / edit dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editing ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogContent>
            {editing ? (
              <TextField
                label={t('recipe')}
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
                noOptionsText={t('noRecipes')}
                renderInput={(params) => (
                  <TextField {...params} label={t('recipe')} required margin="normal" autoFocus />
                )}
              />
            )}

            <TextField
              label={t('date')}
              type="date"
              fullWidth
              required
              margin="normal"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('servings')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  size="small"
                  aria-label={t('aria.decreaseServings')}
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
                  aria-label={t('aria.increaseServings')}
                  onClick={() => setServings((n) => Math.max(1, n + 1))}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
              {recipe && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {t('recipeServes', { count: recipe.servings })}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog} disabled={saving}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !canSubmit}>
              {editing ? t('common:saveChanges') : t('common:add')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('deleteTitle')}
        message={t('deleteMessage', {
          title: toDelete?.recipe.title ?? '',
          date: toDelete ? dateLabel(toDelete.date) : '',
        })}
        confirmLabel={t('common:remove')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
