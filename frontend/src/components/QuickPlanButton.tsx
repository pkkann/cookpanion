import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import DateField from './DateField'
import { useCreatePlannedMeal, usePlannedMeals } from '../api/hooks'
import { useNotify } from './SnackbarProvider'
import { useT } from '../i18n/LanguageProvider'
import { errorMessage } from '../api/client'
import { todayIso } from '../utils/date'
import type { Recipe } from '../api/types'

interface QuickPlanButtonProps {
  recipe: Recipe
  /** `icon` for card action rows, `button` for the detail header. */
  variant: 'icon' | 'button'
  /** Forwarded to the `button` variant to match responsive sibling buttons. */
  fullWidth?: boolean
  /**
   * Servings to plan for. Defaults to the recipe's own servings; the detail
   * page passes its live scaled value so planning matches what's on screen.
   */
  servings?: number
}

/**
 * A recipe-side shortcut for adding a recipe to the meal plan: opens a small
 * popover to pick a date (defaulting to today), then creates the planned meal.
 * The create mutation invalidates the planned-meals query, so the Plan page
 * refreshes on its own.
 */
export default function QuickPlanButton({
  recipe,
  variant,
  fullWidth,
  servings,
}: QuickPlanButtonProps) {
  const t = useT()
  const notify = useNotify()
  const createMut = useCreatePlannedMeal()
  const { data: plannedMeals } = usePlannedMeals()

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [date, setDate] = useState(todayIso())

  const plannedDates = useMemo(
    () => new Set((plannedMeals ?? []).map((m) => m.date)),
    [plannedMeals],
  )

  const open = (e: MouseEvent<HTMLElement>) => {
    setDate(todayIso())
    setAnchorEl(e.currentTarget)
  }
  const close = () => setAnchorEl(null)

  const handleAdd = async () => {
    if (!date) return
    try {
      await createMut.mutateAsync({
        recipeId: recipe.id,
        date,
        servings: Math.max(1, servings ?? recipe.servings),
      })
      notify(t('Added “{title}” to your plan', { title: recipe.title }), 'success')
      close()
    } catch (err) {
      notify(errorMessage(err, t('Could not save planned meal')), 'error')
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip title={t('Add to meal plan')}>
          <IconButton size="small" aria-label={t('Add to meal plan')} onClick={open}>
            <CalendarMonthIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          fullWidth={fullWidth}
          startIcon={<CalendarMonthIcon />}
          onClick={open}
        >
          {t('Plan')}
        </Button>
      )}

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 220 }}>
          <DateField
            label={t('Date')}
            size="small"
            value={date}
            onChange={setDate}
            markedDates={plannedDates}
          />
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!date || createMut.isPending}
          >
            {t('Add to plan')}
          </Button>
        </Box>
      </Popover>
    </>
  )
}
