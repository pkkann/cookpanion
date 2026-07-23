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
  const notify = useNotify()
  const isMobile = useIsMobile()
  const { data: ingredients } = useIngredients()
  const createMut = useCreateRecipe()
  const updateMut = useUpdateRecipe()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('4')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [steps, setSteps] = useState<StepState[]>([newStep()])
  const [rows, setRows] = useState<RowState[]>([newRow()])

  // Reset form whenever the dialog opens for a given recipe (or fresh create).
  useEffect(() => {
    if (!open) return
    if (recipe) {
      setTitle(recipe.title)
      setDescription(recipe.description ?? '')
      setServings(String(recipe.servings ?? 1))
      setPrepTime(recipe.prepTimeMinutes != null ? String(recipe.prepTimeMinutes) : '')
      setCookTime(recipe.cookTimeMinutes != null ? String(recipe.cookTimeMinutes) : '')
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
      setPrepTime('')
      setCookTime('')
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

    const parseMinutes = (v: string): number | null => {
      const trimmed = v.trim()
      if (trimmed === '') return null
      return Math.max(0, Math.round(Number(trimmed) || 0))
    }

    const validRows = rows.filter((r) => r.ingredient && r.quantity !== '' && r.unit.trim())
    const payload: RecipePayload = {
      title: title.trim(),
      description: description.trim(),
      instructions: steps.map((s) => s.text.trim()).filter(Boolean),
      servings: Math.max(1, Math.round(Number(servings) || 1)),
      prepTimeMinutes: parseMinutes(prepTime),
      cookTimeMinutes: parseMinutes(cookTime),
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
        notify('Recipe updated', 'success')
      } else {
        await createMut.mutateAsync(payload)
        notify('Recipe created', 'success')
      }
      onClose()
    } catch (err) {
      notify(errorMessage(err, 'Could not save recipe'), 'error')
    }
  }

  const options = ingredients ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{recipe ? 'Edit recipe' : 'New recipe'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            required
            autoFocus
            margin="normal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextField
            label="Default servings"
            type="number"
            margin="normal"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            helperText="Enter ingredient amounts for this many servings. Viewers can rescale from here."
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />

          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Prep time (min)"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              placeholder="optional"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
            />
            <TextField
              label="Cook time (min)"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              placeholder="optional"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Ingredients
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
                    <TextField {...params} label="Ingredient" size="small" />
                  )}
                />
                <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'flex-start' }}>
                  <TextField
                    label="Qty"
                    type="number"
                    size="small"
                    sx={{ flex: 1, minWidth: 72 }}
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                  <UnitSelect
                    label="Unit"
                    size="small"
                    sx={{ flex: 1, minWidth: 72 }}
                    value={row.unit}
                    onChange={(unit) => updateRow(row.key, { unit })}
                  />
                  <IconButton
                    aria-label="remove ingredient"
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
            Add ingredient
          </Button>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Instructions
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
                    placeholder="Describe this step…"
                    value={step.text}
                    onChange={(e) => updateStep(step.key, e.target.value)}
                  />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: { xs: 'flex-end', sm: 'initial' } }}>
                  <IconButton
                    size="small"
                    aria-label="move step up"
                    disabled={idx === 0}
                    onClick={() => moveStep(idx, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="move step down"
                    disabled={idx === steps.length - 1}
                    onClick={() => moveStep(idx, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="remove step"
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
            Add step
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !title.trim()}>
            {recipe ? 'Save changes' : 'Create recipe'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
