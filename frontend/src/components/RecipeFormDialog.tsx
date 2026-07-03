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
import { useCreateRecipe, useIngredients, useUpdateRecipe } from '../api/hooks'
import { useNotify } from './SnackbarProvider'
import { errorMessage } from '../api/client'
import type { Ingredient, Recipe, RecipePayload } from '../api/types'

interface RowState {
  key: string
  ingredient: Ingredient | null
  quantity: string
  unit: string
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

export default function RecipeFormDialog({ open, recipe, onClose }: RecipeFormDialogProps) {
  const notify = useNotify()
  const { data: ingredients } = useIngredients()
  const createMut = useCreateRecipe()
  const updateMut = useUpdateRecipe()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('4')
  const [instructions, setInstructions] = useState('')
  const [rows, setRows] = useState<RowState[]>([newRow()])

  // Reset form whenever the dialog opens for a given recipe (or fresh create).
  useEffect(() => {
    if (!open) return
    if (recipe) {
      setTitle(recipe.title)
      setDescription(recipe.description ?? '')
      setServings(String(recipe.servings ?? 1))
      setInstructions(recipe.instructions ?? '')
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
      setInstructions('')
      setRows([newRow()])
    }
  }, [open, recipe])

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addRow = () => setRows((rs) => [...rs, newRow()])
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))

  const saving = createMut.isPending || updateMut.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const validRows = rows.filter((r) => r.ingredient && r.quantity !== '' && r.unit.trim())
    const payload: RecipePayload = {
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Ingredients
          </Typography>
          <Stack spacing={1.5}>
            {rows.map((row) => (
              <Stack key={row.key} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
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
                <TextField
                  label="Qty"
                  type="number"
                  size="small"
                  sx={{ flex: 1, minWidth: 72 }}
                  slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                />
                <TextField
                  label="Unit"
                  size="small"
                  sx={{ flex: 1, minWidth: 72 }}
                  value={row.unit}
                  onChange={(e) => updateRow(row.key, { unit: e.target.value })}
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
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} onClick={addRow} sx={{ mt: 1.5 }} size="small">
            Add ingredient
          </Button>

          <Divider sx={{ my: 2 }} />
          <TextField
            label="Instructions"
            fullWidth
            margin="normal"
            multiline
            minRows={5}
            placeholder="Step-by-step method…"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
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
