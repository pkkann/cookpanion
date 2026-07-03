import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { useCookRecipe } from '../api/hooks'
import { useNotify } from './SnackbarProvider'
import { errorMessage } from '../api/client'
import { formatQuantity } from '../utils/quantity'
import type { AvailabilityStatus } from '../utils/availability'
import { useTranslation } from 'react-i18next'

export interface CookRow {
  ingredientId: number
  name: string
  /** The recipe's unit for this ingredient. */
  unit: string
  /** Scaled amount the recipe needs. */
  needed: number
  /** Amount currently in the kitchen (0 when not tracked). */
  have: number
  /** The kitchen unit (may differ from the recipe unit). */
  haveUnit: string
  status: AvailabilityStatus
}

interface CookDialogProps {
  open: boolean
  onClose: () => void
  recipeId: number
  recipeTitle: string
  servings: number
  rows: CookRow[]
}

/** A row is deductible when its units are comparable and something is on hand. */
function isDeductible(row: CookRow): boolean {
  return (row.status === 'enough' || row.status === 'partial') && row.have > 0
}

export default function CookDialog({
  open,
  onClose,
  recipeId,
  recipeTitle,
  servings,
  rows,
}: CookDialogProps) {
  const { t } = useTranslation(['recipes', 'common', 'errors'])
  const notify = useNotify()
  const cookMut = useCookRecipe()

  // Editable "use" amount per ingredient, keyed by id. Defaults to the needed amount.
  const [uses, setUses] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!open) return
    const initial: Record<number, string> = {}
    for (const row of rows) {
      if (isDeductible(row)) initial[row.ingredientId] = String(row.needed)
    }
    setUses(initial)
  }, [open, rows])

  const useValue = (row: CookRow) => Math.max(0, parseFloat(uses[row.ingredientId] ?? '') || 0)

  const skipped = useMemo(() => rows.filter((r) => !isDeductible(r)), [rows])

  // Rows where the amount used exceeds what's on hand — stock will floor at 0.
  const shortNames = rows
    .filter((r) => isDeductible(r) && useValue(r) > r.have)
    .map((r) => r.name)

  const deductibleCount = rows.filter(isDeductible).length

  const handleConfirm = async () => {
    const items = rows
      .filter(isDeductible)
      .map((r) => ({ ingredientId: r.ingredientId, quantity: useValue(r) }))
      .filter((i) => i.quantity > 0)

    try {
      await cookMut.mutateAsync({ id: recipeId, payload: { items } })
      notify(t('toast.cooked'), 'success')
      onClose()
    } catch (err) {
      notify(errorMessage(err, t('errors:saveStock')), 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('cook.title', { title: recipeTitle })}
        <Typography variant="body2" color="text.secondary">
          {t('cook.servings', { count: servings })}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.25} sx={{ mt: 0.5 }}>
          {rows.map((row) => {
            const deductible = isDeductible(row)
            const left = Math.max(0, row.have - useValue(row))
            return (
              <Box key={row.ingredientId}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                    {row.name}
                  </Typography>
                  {!deductible && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={
                        row.status === 'unknown'
                          ? t('cook.unitDiffers')
                          : t('cook.notInKitchen')
                      }
                    />
                  )}
                </Stack>
                {deductible && (
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t('cook.have', { amount: `${formatQuantity(row.have)} ${row.haveUnit}`.trim() })}
                    </Typography>
                    <TextField
                      label={t('cook.use')}
                      type="number"
                      size="small"
                      sx={{ width: 120 }}
                      slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                      value={uses[row.ingredientId] ?? ''}
                      onChange={(e) =>
                        setUses((prev) => ({ ...prev, [row.ingredientId]: e.target.value }))
                      }
                      helperText={row.unit || undefined}
                    />
                    <Typography variant="body2">
                      {t('cook.left', { amount: `${formatQuantity(left)} ${row.haveUnit}`.trim() })}
                    </Typography>
                  </Stack>
                )}
              </Box>
            )
          })}
        </Stack>

        {shortNames.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2, py: 0.25 }}>
            {t('cook.shortWarning', { list: shortNames.join(', ') })}
          </Alert>
        )}
        {skipped.length > 0 && (
          <Alert severity="info" sx={{ mt: 1, py: 0.25 }}>
            {t('cook.skippedWarning', { list: skipped.map((r) => r.name).join(', ') })}
          </Alert>
        )}
        {deductibleCount === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t('cook.nothingToDeduct')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={cookMut.isPending}>
          {t('common:cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={cookMut.isPending || deductibleCount === 0}
        >
          {t('cook.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
