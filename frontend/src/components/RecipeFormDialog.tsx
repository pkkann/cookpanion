import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { useCreateRecipe, useIngredients, useUpdateRecipe } from '../api/hooks'
import UnitSelect from './UnitSelect'
import { useNotify } from './SnackbarProvider'
import { errorMessage } from '../api/client'
import type { Ingredient, Recipe, RecipePayload } from '../api/types'
import { useIsMobile } from '../utils/useIsMobile'
import { useTranslation } from 'react-i18next'

interface RowState {
  key: string
  ingredient: Ingredient | null
  quantity: string
  unit: string
}

interface StepState {
  key: string
  text: string
}

interface RecipeFormDialogProps {
  open: boolean
  recipe: Recipe | null // null => create
  onClose: () => void
}

let rowCounter = 0
const newRow = (): RowState => ({
  key: `row-${rowCounter++}`,
  ingredient: null,
  quantity: '',
  unit: '',
})

let stepCounter = 0
const newStep = (text = ''): StepState => ({ key: `step-${stepCounter++}`, text })

export default function RecipeFormDialog({ open, recipe, onClose }: RecipeFormDialogProps) {
  const { t } = useTranslation(['recipes', 'common', 'errors'])
  const notify = useNotify()
  const isMobile = useIsMobile()
  const { data: ingredients } = useIngredients()
  const createMut = useCreateRecipe()
  const updateMut = useUpdateRecipe()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('4')
  const [steps, setSteps] = useState<StepState[]>([newStep()])
  const [rows, setRows] = useState<RowState[]>([newRow()])

  // Reset form whenever the dialog opens for a given recipe (or fresh create).
  useEffect(() => {
    if (!open) return
    if (recipe) {
      setTitle(recipe.title)
      setDescription(recipe.description ?? '')
      setServings(String(recipe.servings ?? 1))
      setSteps(
        recipe.instructions.length > 0
          ? recipe.instructions.map((text) => newStep(text))
          : [newStep()],
      )
      setRows(
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((ri) => ({
              key: `row-${rowCounter++}`,
              ingredient: ri.ingredient,
              quantity: String(ri.quantity),
              unit: ri.unit,
            }))
          : [newRow()],
      )
    } else {
      setTitle('')
      setDescription('')
      setServings('4')
      setSteps([newStep()])
      setRows([newRow()])
    }
  }, [open, recipe])

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addRow = () => setRows((rs) => [...rs, newRow()])
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))

  const updateStep = (key: string, text: string) =>
    setSteps((ss) => ss.map((s) => (s.key === key ? { ...s, text } : s)))
  const addStep = () => setSteps((ss) => [...ss, newStep()])
  const removeStep = (key: string) => setSteps((ss) => ss.filter((s) => s.key !== key))
  const moveStep = (index: number, dir: -1 | 1) =>
    setSteps((ss) => {
      const next = [...ss]
      const target = index + dir
      if (target < 0 || target >= next.length) return ss
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const saving = createMut.isPending || updateMut.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const validRows = rows.filter((r) => r.ingredient && r.quantity !== '' && r.unit.trim())
    const payload: RecipePayload = {
      title: title.trim(),
      description: description.trim(),
      instructions: steps.map((s) => s.text.trim()).filter(Boolean),
      servings: Math.max(1, Math.round(Number(servings) || 1)),
      ingredients: validRows.map((r) => ({
        ingredientId: r.ingredient!.id,
        quantity: Number(r.quantity),
        unit: r.unit.trim(),
      })),
    }

    if (!payload.title) return

    try {
      if (recipe) {
        await updateMut.mutateAsync({ id: recipe.id, payload })
        notify(t('toast.updated'), 'success')
      } else {
        await createMut.mutateAsync(payload)
        notify(t('toast.created'), 'success')
      }
      onClose()
    } catch (err) {
      notify(errorMessage(err, t('errors:saveRecipe')), 'error')
    }
  }

  const options = ingredients ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{recipe ? t('form.editTitle') : t('form.newTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('form.title')}
            fullWidth
            required
            autoFocus
            margin="normal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label={t('form.description')}
            fullWidth
            margin="normal"
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextField
            label={t('form.defaultServings')}
            type="number"
            margin="normal"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            helperText={t('form.servingsHelp')}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {t('form.ingredients')}
          </Typography>
          <Stack spacing={1.5}>
            {rows.map((row) => (
              <Stack
                key={row.key}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
              >
                <Autocomplete
                  sx={{ flex: 2, minWidth: 0 }}
                  options={options}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={row.ingredient}
                  onChange={(_e, val) =>
                    updateRow(row.key, {
                      ingredient: val,
                      unit: row.unit || val?.defaultUnit || '',
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label={t('form.ingredient')} size="small" />
                  )}
                />
                <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'flex-start' }}>
                  <TextField
                    label={t('form.qty')}
                    type="number"
                    size="small"
                    sx={{ flex: 1, minWidth: 72 }}
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                  <UnitSelect
                    label={t('form.unit')}
                    size="small"
                    sx={{ flex: 1, minWidth: 72 }}
                    value={row.unit}
                    onChange={(unit) => updateRow(row.key, { unit })}
                  />
                  <IconButton
                    aria-label={t('form.removeIngredient')}
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} onClick={addRow} sx={{ mt: 1.5 }} size="small">
            {t('form.addIngredient')}
          </Button>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {t('form.instructions')}
          </Typography>
          <Stack spacing={1.5}>
            {steps.map((step, idx) => (
              <Stack
                key={step.key}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
              >
                <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'flex-start' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.75, minWidth: 20 }}>
                    {idx + 1}.
                  </Typography>
                  <TextField
                    sx={{ flex: 1 }}
                    size="small"
                    multiline
                    minRows={2}
                    placeholder={t('form.stepPlaceholder')}
                    value={step.text}
                    onChange={(e) => updateStep(step.key, e.target.value)}
                  />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: { xs: 'flex-end', sm: 'initial' } }}>
                  <IconButton
                    size="small"
                    aria-label={t('form.moveStepUp')}
                    disabled={idx === 0}
                    onClick={() => moveStep(idx, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('form.moveStepDown')}
                    disabled={idx === steps.length - 1}
                    onClick={() => moveStep(idx, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('form.removeStep')}
                    disabled={steps.length === 1}
                    onClick={() => removeStep(step.key)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} onClick={addStep} sx={{ mt: 1.5 }} size="small">
            {t('form.addStep')}
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !title.trim()}>
            {recipe ? t('common:saveChanges') : t('form.createRecipe')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
