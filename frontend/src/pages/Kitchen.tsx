import { useMemo, useState } from 'react'
import type { FormEvent, Key } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import { Link as RouterLink } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import KitchenIcon from '@mui/icons-material/Kitchen'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import UnitSelect from '../components/UnitSelect'
import { useNotify } from '../components/SnackbarProvider'
import {
  useCreateIngredient,
  useCreateStock,
  useDeleteStock,
  useIngredients,
  useStock,
  useUpdateStock,
} from '../api/hooks'
import type { Ingredient, StockItem } from '../api/types'
import { errorMessage } from '../api/client'
import { useIsMobile } from '../utils/useIsMobile'
import { useTranslation } from 'react-i18next'

// A synthetic Autocomplete option representing "create this new ingredient".
type NewIngredientOption = { inputValue: string; isNew: true }
type IngredientOption = Ingredient | NewIngredientOption

const isNewOption = (o: IngredientOption): o is NewIngredientOption =>
  (o as NewIngredientOption).isNew === true

const filterIngredients = createFilterOptions<IngredientOption>()

export default function Kitchen() {
  const { t } = useTranslation(['kitchen', 'common', 'errors'])
  const notify = useNotify()
  const isMobile = useIsMobile()
  const { data: stock, isLoading, isError, error } = useStock()
  const { data: ingredients } = useIngredients()
  const createMut = useCreateStock()
  const updateMut = useUpdateStock()
  const deleteMut = useDeleteStock()
  const createIngredientMut = useCreateIngredient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StockItem | null>(null)
  const [toDelete, setToDelete] = useState<StockItem | null>(null)

  // form fields
  const [ingredient, setIngredient] = useState<IngredientOption | null>(null)
  const [ingredientInput, setIngredientInput] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')

  // Ingredients not already stocked (for the add flow).
  const availableIngredients = useMemo(() => {
    const stockedIds = new Set((stock ?? []).map((s) => s.ingredient.id))
    return (ingredients ?? [])
      .filter((i) => !stockedIds.has(i.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [ingredients, stock])

  const sortedStock = useMemo(
    () => [...(stock ?? [])].sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name)),
    [stock],
  )

  const openAdd = () => {
    setEditing(null)
    setIngredient(null)
    setIngredientInput('')
    setQuantity('')
    setUnit('')
    setDialogOpen(true)
  }

  const openEdit = (item: StockItem) => {
    setEditing(item)
    setIngredient(item.ingredient)
    setQuantity(String(item.quantity))
    setUnit(item.unit)
    setDialogOpen(true)
  }

  const closeDialog = () => setDialogOpen(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const qty = Number(quantity)
    if (!Number.isFinite(qty)) return
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: { quantity: qty, unit: unit.trim() } })
        notify(t('toast.updated'), 'success')
      } else {
        if (!ingredient) return
        let ingredientId: number
        if (isNewOption(ingredient)) {
          // Create the ingredient first (the chosen unit becomes the
          // ingredient's default), then stock it.
          const created = await createIngredientMut.mutateAsync({
            name: ingredient.inputValue.trim(),
            defaultUnit: unit.trim() || null,
          })
          ingredientId = created.id
        } else {
          ingredientId = ingredient.id
        }
        // If the stock call below fails after the ingredient was created, the
        // ingredient persists; a retry matches it as an existing option, so no
        // duplicate is created.
        await createMut.mutateAsync({
          ingredientId,
          quantity: qty,
          unit: unit.trim(),
        })
        notify(t('toast.added'), 'success')
      }
      closeDialog()
    } catch (err) {
      notify(errorMessage(err, t('errors:saveStock')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify(t('toast.removed'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('errors:removeStockItem')), 'error')
    }
  }

  const saving = createMut.isPending || updateMut.isPending || createIngredientMut.isPending
  const noIngredientsAtAll = (ingredients?.length ?? 0) === 0

  // The typed name matches an ingredient that's already stocked (so it's absent
  // from availableIngredients and we don't offer "Add") — surface a hint instead.
  const trimmedInput = ingredientInput.trim().toLowerCase()
  const matchesStockedName =
    trimmedInput.length > 0 &&
    (stock ?? []).some((s) => s.ingredient.name.toLowerCase() === trimmedInput)

  return (
    <Box>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            disabled={isLoading}
          >
            {t('addStock')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('errors:loadStock'))}
        </Alert>
      )}

      {isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      ) : sortedStock.length === 0 ? (
        <EmptyState
          icon={<KitchenIcon fontSize="inherit" />}
          title={t('emptyTitle')}
          description={
            noIngredientsAtAll ? t('emptyDescriptionNoIngredients') : t('emptyDescription')
          }
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
              {t('addStock')}
            </Button>
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {sortedStock.map((item) => (
            <Card key={item.id} variant="outlined">
              <CardContent
                sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                    {item.ingredient.name}
                  </Typography>
                  <Typography variant="h6" color="primary" sx={{ mt: 0.5 }}>
                    {item.quantity} {item.unit}
                  </Typography>
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    aria-label={t('common:aria.edit')}
                    onClick={() => openEdit(item)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('common:aria.delete')}
                    color="error"
                    onClick={() => setToDelete(item)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Add / edit stock dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editing ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogContent>
            {editing ? (
              <TextField
                label={t('ingredient')}
                fullWidth
                margin="normal"
                value={editing.ingredient.name}
                disabled
              />
            ) : (
              <Autocomplete<IngredientOption>
                options={availableIngredients}
                value={ingredient}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                onInputChange={(_e, val) => setIngredientInput(val)}
                getOptionLabel={(o) =>
                  typeof o === 'string' ? o : isNewOption(o) ? o.inputValue : o.name
                }
                isOptionEqualToValue={(o, v) =>
                  isNewOption(o) || isNewOption(v)
                    ? isNewOption(o) && isNewOption(v) && o.inputValue === v.inputValue
                    : o.id === v.id
                }
                filterOptions={(options, params) => {
                  const filtered = filterIngredients(options, params)
                  const typed = params.inputValue.trim()
                  // Offer "Add" only for a genuinely new name: dedupe against the
                  // full ingredient list (there's no backend uniqueness constraint),
                  // case-insensitive.
                  if (
                    typed &&
                    !(ingredients ?? []).some(
                      (i) => i.name.toLowerCase() === typed.toLowerCase(),
                    )
                  ) {
                    filtered.push({ inputValue: typed, isNew: true })
                  }
                  return filtered
                }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props as typeof props & { key: Key }
                  return (
                    <li key={key} {...rest}>
                      {isNewOption(option)
                        ? t('addNewIngredient', { name: option.inputValue })
                        : option.name}
                    </li>
                  )
                }}
                onChange={(_e, val) => {
                  setIngredient(val)
                  if (val && !isNewOption(val) && val.defaultUnit && !unit) {
                    setUnit(val.defaultUnit)
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('ingredient')}
                    required
                    margin="normal"
                    autoFocus
                    helperText={
                      matchesStockedName
                        ? t('alreadyStockedHint', { name: ingredientInput.trim() })
                        : undefined
                    }
                  />
                )}
              />
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('quantity')}
                type="number"
                required
                margin="normal"
                fullWidth
                slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <UnitSelect
                label={t('unit')}
                required
                margin="normal"
                fullWidth
                value={unit}
                onChange={setUnit}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog} disabled={saving}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || (!editing && !ingredient) || !quantity || !unit.trim()}
            >
              {editing ? t('common:saveChanges') : t('common:add')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('deleteTitle')}
        message={t('deleteMessage', { name: toDelete?.ingredient.name ?? '' })}
        confirmLabel={t('common:remove')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {availableIngredients.length === 0 && !noIngredientsAtAll && sortedStock.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {t('allStockedPrefix')}
          <Link component={RouterLink} to="/ingredients">
            {t('ingredientsPageLink')}
          </Link>
          {t('allStockedSuffix')}
        </Typography>
      )}
    </Box>
  )
}
