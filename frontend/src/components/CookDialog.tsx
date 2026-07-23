import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
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
import { useIsMobile } from '../utils/useIsMobile'

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
  const notify = useNotify()
  const isMobile = useIsMobile()
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

  const usedAmount = (row: CookRow) => Math.max(0, parseFloat(uses[row.ingredientId] ?? '') || 0)

  // "Skipped" = can't be deducted for a problem reason (unit mismatch / not in
  // kitchen). Always-in-stock staples are intentionally not deducted, so they
  // aren't flagged here.
  const skipped = useMemo(
    () => rows.filter((r) => !isDeductible(r) && r.status !== 'always'),
    [rows],
  )

  // Rows where the amount used exceeds what's on hand — the stock row will be
  // used up and removed from the kitchen.
  const shortNames = rows
    .filter((r) => isDeductible(r) && usedAmount(r) > r.have)
    .map((r) => r.name)

  const deductibleCount = rows.filter(isDeductible).length

  const handleConfirm = async () => {
    const items = rows
      .filter(isDeductible)
      .map((r) => ({ ingredientId: r.ingredientId, quantity: usedAmount(r) }))
      .filter((i) => i.quantity > 0)

    try {
      await cookMut.mutateAsync({ id: recipeId, payload: { items } })
      notify('Kitchen updated', 'success')
      onClose()
    } catch (err) {
      notify(errorMessage(err, 'Could not save stock'), 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>
        {`Cook "${recipeTitle}"`}
        <Typography variant="body2" color="text.secondary">
          {`${servings} servings`}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 0.5 }}>
          {rows.map((row) => {
            const deductible = isDeductible(row)
            const left = Math.max(0, row.have - usedAmount(row))
            const isAlways = row.status === 'always'
            const skipLabel = isAlways
              ? 'Always in stock'
              : row.status === 'unknown'
                ? 'Unit differs — skipped'
                : 'Not in kitchen — skipped'
            return (
              <Box
                key={row.ingredientId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 140px 112px' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  columnGap: 1.5,
                  rowGap: { xs: 1, sm: 0 },
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 1.75,
                  py: 1.25,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                    {row.name}
                  </Typography>
                  {row.have > 0 && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {`In kitchen: ${`${formatQuantity(row.have)} ${row.haveUnit}`.trim()}`}
                    </Typography>
                  )}
                </Box>

                {deductible ? (
                  <>
                    <TextField
                      label="Use"
                      type="number"
                      size="small"
                      fullWidth
                      value={uses[row.ingredientId] ?? ''}
                      onChange={(e) =>
                        setUses((prev) => ({ ...prev, [row.ingredientId]: e.target.value }))
                      }
                      slotProps={{
                        htmlInput: { min: 0, step: 'any', style: { textAlign: 'center' } },
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">{row.unit}</InputAdornment>
                          ),
                        },
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {`Left: ${`${formatQuantity(left)} ${row.haveUnit}`.trim()}`}
                    </Typography>
                  </>
                ) : (
                  <Chip
                    size="small"
                    color={isAlways ? 'success' : 'warning'}
                    variant="outlined"
                    label={skipLabel}
                    sx={{ gridColumn: { xs: '1', sm: '2 / 4' }, justifySelf: 'start' }}
                  />
                )}
              </Box>
            )
          })}
        </Stack>

        {shortNames.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2, py: 0.25 }}>
            {`Not enough of: ${shortNames.join(', ')} — stock will drop to 0.`}
          </Alert>
        )}
        {skipped.length > 0 && (
          <Alert severity="info" sx={{ mt: 1, py: 0.25 }}>
            {`Skipped (unit mismatch or not in kitchen): ${skipped.map((r) => r.name).join(', ')}`}
          </Alert>
        )}
        {deductibleCount === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No kitchen ingredients to deduct.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={cookMut.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={cookMut.isPending || deductibleCount === 0}
        >
          Cook it
        </Button>
      </DialogActions>
    </Dialog>
  )
}
