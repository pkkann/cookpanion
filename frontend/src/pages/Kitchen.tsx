import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
  useCreateStock,
  useDeleteStock,
  useIngredients,
  useStock,
  useUpdateStock,
} from '../api/hooks'
import type { Ingredient, StockItem } from '../api/types'
import { errorMessage } from '../api/client'
import { useTranslation } from 'react-i18next'

export default function Kitchen() {
  const { t } = useTranslation(['kitchen', 'common', 'errors'])
  const notify = useNotify()
  const { data: stock, isLoading, isError, error } = useStock()
  const { data: ingredients } = useIngredients()
  const createMut = useCreateStock()
  const updateMut = useUpdateStock()
  const deleteMut = useDeleteStock()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StockItem | null>(null)
  const [toDelete, setToDelete] = useState<StockItem | null>(null)

  // form fields
  const [ingredient, setIngredient] = useState<Ingredient | null>(null)
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
        await createMut.mutateAsync({
          ingredientId: ingredient.id,
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

  const saving = createMut.isPending || updateMut.isPending
  const noIngredientsAtAll = (ingredients?.length ?? 0) === 0

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
            disabled={!isLoading && availableIngredients.length === 0}
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
            noIngredientsAtAll ? (
              <Button component={RouterLink} to="/ingredients" variant="contained">
                {t('goToIngredients')}
              </Button>
            ) : (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
                {t('addStock')}
              </Button>
            )
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
                  {item.ingredient.category && (
                    <Chip size="small" label={item.ingredient.category} sx={{ mt: 1 }} />
                  )}
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
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
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
              <Autocomplete
                options={availableIngredients}
                getOptionLabel={(o) => o.name}
                value={ingredient}
                onChange={(_e, val) => {
                  setIngredient(val)
                  if (val?.defaultUnit && !unit) setUnit(val.defaultUnit)
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('ingredient')}
                    required
                    margin="normal"
                    autoFocus
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
