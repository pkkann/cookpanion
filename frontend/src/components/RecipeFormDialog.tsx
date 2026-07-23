import { useEffect, useState } from 'react'
import type { FormEvent, Key } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { useCreateIngredient, useCreateRecipe, useIngredients, useUpdateRecipe } from '../api/hooks'
import UnitSelect from './UnitSelect'
import { useNotify } from './SnackbarProvider'
import { useT } from '../i18n/LanguageProvider'
import { errorMessage } from '../api/client'
import type {
  ImportedRecipe,
  Ingredient,
  Recipe,
  RecipeIngredientPayload,
  RecipePayload,
} from '../api/types'
import { useIsMobile } from '../utils/useIsMobile'

// A synthetic Autocomplete option representing "create this new ingredient"
// (mirrors the pattern used on the Kitchen page).
type NewIngredientOption = { inputValue: string; isNew: true }
type IngredientOption = Ingredient | NewIngredientOption

const isNewOption = (o: IngredientOption): o is NewIngredientOption =>
  (o as NewIngredientOption).isNew === true

const filterIngredients = createFilterOptions<IngredientOption>()

interface RowState {
  key: string
  ingredient: IngredientOption | null
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
  /** Optional prefill for a create (e.g. an AI-imported recipe) to review before saving. */
  draft?: ImportedRecipe | null
  onClose: () => void
  /** Called with the created/updated recipe after a successful save. */
  onSaved?: (recipe: Recipe) => void
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

export default function RecipeFormDialog({
  open,
  recipe,
  draft,
  onClose,
  onSaved,
}: RecipeFormDialogProps) {
  const notify = useNotify()
  const t = useT()
  const isMobile = useIsMobile()
  const { data: ingredients } = useIngredients()
  const createMut = useCreateRecipe()
  const updateMut = useUpdateRecipe()
  const createIngredientMut = useCreateIngredient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState('4')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [steps, setSteps] = useState<StepState[]>([newStep()])
  const [rows, setRows] = useState<RowState[]>([newRow()])

  // Reset form whenever the dialog opens for a given recipe / draft (or fresh create).
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
    } else if (draft) {
      // Prefill from an imported recipe. Ingredients are name-based: match existing
      // ones for display; unmatched names become "new" options and are created on save.
      const byName = new Map<string, Ingredient>()
      for (const ing of ingredients ?? []) byName.set(ing.name.trim().toLowerCase(), ing)

      setTitle(draft.title)
      setDescription(draft.description ?? '')
      setServings(String(draft.servings || 1))
      setPrepTime(draft.prepTimeMinutes ? String(draft.prepTimeMinutes) : '')
      setCookTime(draft.cookTimeMinutes ? String(draft.cookTimeMinutes) : '')
      setSteps(
        draft.instructions.length > 0
          ? draft.instructions.map((text) => newStep(text))
          : [newStep()],
      )
      setRows(
        draft.ingredients.length > 0
          ? draft.ingredients.map((di) => ({
              key: `row-${rowCounter++}`,
              ingredient:
                byName.get(di.name.trim().toLowerCase()) ??
                ({ inputValue: di.name, isNew: true } as NewIngredientOption),
              quantity: di.quantity != null ? String(di.quantity) : '',
              unit: di.unit ?? '',
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
    // `ingredients` is intentionally omitted: it's only read to seed row display, and
    // re-running when it loads would discard edits. Save-time resolution is authoritative.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe, draft])

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

  const saving = createMut.isPending || updateMut.isPending || createIngredientMut.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const parseMinutes = (v: string): number | null => {
      const trimmed = v.trim()
      if (trimmed === '') return null
      return Math.max(0, Math.round(Number(trimmed) || 0))
    }

    const validRows = rows.filter((r) => r.ingredient && r.quantity !== '' && r.unit.trim())

    try {
      // Resolve each row to an ingredient id, creating new ones (deduped by name).
      const byName = new Map<string, Ingredient>()
      for (const ing of ingredients ?? []) byName.set(ing.name.trim().toLowerCase(), ing)

      const ingredientPayloads: RecipeIngredientPayload[] = []
      for (const r of validRows) {
        const opt = r.ingredient!
        let resolved: Ingredient
        if (isNewOption(opt)) {
          const key = opt.inputValue.trim().toLowerCase()
          resolved =
            byName.get(key) ??
            (await createIngredientMut.mutateAsync({
              name: opt.inputValue.trim(),
              defaultUnit: r.unit.trim() || null,
            }))
          byName.set(key, resolved)
        } else {
          resolved = opt
        }
        ingredientPayloads.push({
          ingredientId: resolved.id,
          quantity: Number(r.quantity),
          unit: r.unit.trim(),
        })
      }

      const payload: RecipePayload = {
        title: trimmedTitle,
        description: description.trim(),
        instructions: steps.map((s) => s.text.trim()).filter(Boolean),
        servings: Math.max(1, Math.round(Number(servings) || 1)),
        prepTimeMinutes: parseMinutes(prepTime),
        cookTimeMinutes: parseMinutes(cookTime),
        ingredients: ingredientPayloads,
      }

      let saved: Recipe
      if (recipe) {
        saved = await updateMut.mutateAsync({ id: recipe.id, payload })
        notify(t('Recipe updated'), 'success')
      } else {
        saved = await createMut.mutateAsync(payload)
        notify(t('Recipe created'), 'success')
      }
      onSaved?.(saved)
      onClose()
    } catch (err) {
      notify(errorMessage(err, t('Could not save recipe')), 'error')
    }
  }

  const baseOptions: IngredientOption[] = ingredients ?? []
  // Ensure a row's current "new" value is present in its options so MUI doesn't
  // warn about a value with no matching option.
  const optionsFor = (row: RowState): IngredientOption[] =>
    row.ingredient && isNewOption(row.ingredient)
      ? [row.ingredient, ...baseOptions]
      : baseOptions

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{recipe ? t('Edit recipe') : t('New recipe')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('Title')}
            fullWidth
            required
            autoFocus
            margin="normal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label={t('Description')}
            fullWidth
            margin="normal"
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextField
            label={t('Default servings')}
            type="number"
            margin="normal"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            helperText={t('Enter ingredient amounts for this many servings. Viewers can rescale from here.')}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />

          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('Prep time (min)')}
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              placeholder={t('optional')}
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
            />
            <TextField
              label={t('Cook time (min)')}
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              placeholder={t('optional')}
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {t('Ingredients')}
          </Typography>
          <Stack spacing={1.5}>
            {rows.map((row) => (
              <Stack
                key={row.key}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
              >
                <Autocomplete<IngredientOption>
                  sx={{ flex: 2, minWidth: 0 }}
                  options={optionsFor(row)}
                  value={row.ingredient}
                  selectOnFocus
                  clearOnBlur
                  handleHomeEndKeys
                  getOptionLabel={(o) =>
                    typeof o === 'string' ? o : isNewOption(o) ? o.inputValue : o.name
                  }
                  isOptionEqualToValue={(o, v) =>
                    isNewOption(o) || isNewOption(v)
                      ? isNewOption(o) && isNewOption(v) && o.inputValue === v.inputValue
                      : o.id === v.id
                  }
                  filterOptions={(opts, params) => {
                    const filtered = filterIngredients(opts, params)
                    const typed = params.inputValue.trim()
                    // Offer "Add" only for a genuinely new name (case-insensitive).
                    if (
                      typed &&
                      !(ingredients ?? []).some((i) => i.name.toLowerCase() === typed.toLowerCase())
                    ) {
                      filtered.push({ inputValue: typed, isNew: true })
                    }
                    return filtered
                  }}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props as typeof props & { key: Key }
                    return (
                      <li key={key} {...rest}>
                        {isNewOption(option) ? t('Add “{name}”', { name: option.inputValue }) : option.name}
                      </li>
                    )
                  }}
                  onChange={(_e, val) =>
                    updateRow(row.key, {
                      ingredient: val,
                      unit:
                        row.unit || (val && !isNewOption(val) ? (val.defaultUnit ?? '') : row.unit),
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label={t('Ingredient')} size="small" />
                  )}
                />
                <Stack direction="row" spacing={1} sx={{ flex: 1, alignItems: 'flex-start' }}>
                  <TextField
                    label={t('Qty')}
                    type="number"
                    size="small"
                    sx={{ flex: 1, minWidth: 72 }}
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                  <UnitSelect
                    label={t('Unit')}
                    size="small"
                    sx={{ flex: 1, minWidth: 72 }}
                    value={row.unit}
                    onChange={(unit) => updateRow(row.key, { unit })}
                  />
                  <IconButton
                    aria-label={t('remove ingredient')}
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
            {t('Add ingredient')}
          </Button>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {t('Instructions')}
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
                    placeholder={t('Describe this step…')}
                    value={step.text}
                    onChange={(e) => updateStep(step.key, e.target.value)}
                  />
                </Stack>
                <Stack direction="row" sx={{ justifyContent: { xs: 'flex-end', sm: 'initial' } }}>
                  <IconButton
                    size="small"
                    aria-label={t('move step up')}
                    disabled={idx === 0}
                    onClick={() => moveStep(idx, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('move step down')}
                    disabled={idx === steps.length - 1}
                    onClick={() => moveStep(idx, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('remove step')}
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
            {t('Add step')}
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            {t('Cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !title.trim()}>
            {recipe ? t('Save changes') : t('Create recipe')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
