import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'
import LocalDiningIcon from '@mui/icons-material/LocalDining'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import UnitSelect from '../components/UnitSelect'
import { useNotify } from '../components/SnackbarProvider'
import {
  useCreateIngredient,
  useDeleteIngredient,
  useIngredients,
  useUpdateIngredient,
} from '../api/hooks'
import type { Ingredient } from '../api/types'
import { errorMessage } from '../api/client'
import { useIsMobile } from '../utils/useIsMobile'
import { useT } from '../i18n/LanguageProvider'
import type { TFunc } from '../i18n/LanguageProvider'

interface EditorState {
  open: boolean
  editing: Ingredient | null
}

type UsageFilter = 'all' | 'inUse' | 'unused'

/** First letter for A–Z grouping; anything non-alphabetic collapses into "#". */
function sectionLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : '#'
}

/** Why an ingredient can't be deleted (empty when it can). */
function deleteReason(ing: Ingredient, t: TFunc): string {
  if (ing.usedInKitchen && ing.usedInRecipes)
    return t("It's in your kitchen and used in recipes, so it can't be deleted.")
  if (ing.usedInKitchen) return t("It's in your kitchen, so it can't be deleted.")
  if (ing.usedInRecipes) return t("It's used in a recipe, so it can't be deleted.")
  return ''
}

export default function Ingredients() {
  const t = useT()
  const notify = useNotify()
  const isMobile = useIsMobile()
  const { data: ingredients, isLoading, isError, error } = useIngredients()
  const createMut = useCreateIngredient()
  const updateMut = useUpdateIngredient()
  const deleteMut = useDeleteIngredient()

  const [editor, setEditor] = useState<EditorState>({ open: false, editing: null })
  const [toDelete, setToDelete] = useState<Ingredient | null>(null)

  // Overview controls
  const [query, setQuery] = useState('')
  const [usage, setUsage] = useState<UsageFilter>('all')

  // form fields
  const [name, setName] = useState('')
  const [defaultUnit, setDefaultUnit] = useState('')
  const [alwaysInStock, setAlwaysInStock] = useState(false)

  const openCreate = () => {
    setName('')
    setDefaultUnit('')
    setAlwaysInStock(false)
    setEditor({ open: true, editing: null })
  }

  const openEdit = (ing: Ingredient) => {
    setName(ing.name)
    setDefaultUnit(ing.defaultUnit ?? '')
    setAlwaysInStock(ing.alwaysInStock)
    setEditor({ open: true, editing: ing })
  }

  const closeEditor = () => setEditor({ open: false, editing: null })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    try {
      if (editor.editing) {
        await updateMut.mutateAsync({
          id: editor.editing.id,
          payload: {
            name: trimmedName,
            defaultUnit: defaultUnit.trim() || null,
            alwaysInStock,
          },
        })
        notify(t('Ingredient updated'), 'success')
      } else {
        await createMut.mutateAsync({
          name: trimmedName,
          defaultUnit: defaultUnit.trim() || null,
          alwaysInStock,
        })
        notify(t('Ingredient added'), 'success')
      }
      closeEditor()
    } catch (err) {
      notify(errorMessage(err, t('Could not save ingredient')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify(t('Ingredient deleted'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('Could not delete ingredient')), 'error')
    }
  }

  const sorted = useMemo(
    () => [...(ingredients ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sorted.filter((ing) => {
      if (usage === 'inUse' && !ing.inUse) return false
      if (usage === 'unused' && ing.inUse) return false
      if (q && !ing.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [sorted, query, usage])

  // Group the (already alphabetically sorted) results by first letter. Because
  // same-letter names are adjacent after sorting, each letter forms one run.
  const groups = useMemo(() => {
    const map = new Map<string, Ingredient[]>()
    for (const ing of filtered) {
      const letter = sectionLetter(ing.name)
      const bucket = map.get(letter)
      if (bucket) bucket.push(ing)
      else map.set(letter, [ing])
    }
    return [...map.entries()]
  }, [filtered])

  const saving = createMut.isPending || updateMut.isPending
  const total = sorted.length
  const filtering = query.trim() !== '' || usage !== 'all'
  const countLabel = filtering
    ? t('{shown} of {total}', { shown: filtered.length, total })
    : total === 1
      ? t('1 ingredient')
      : t('{count} ingredients', { count: total })

  return (
    <Box>
      <PageHeader
        title={t('Ingredients')}
        subtitle={t('The building blocks your household cooks with.')}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('Add ingredient')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('Failed to load ingredients'))}
        </Alert>
      )}

      {isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </Stack>
      ) : total === 0 ? (
        <EmptyState
          icon={<LocalDiningIcon fontSize="inherit" />}
          title={t('No ingredients yet')}
          description={t('Add the ingredients your household uses so you can track stock and build recipes.')}
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {t('Add your first ingredient')}
            </Button>
          }
        />
      ) : (
        <>
          {/* Search + usage filter */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mb: 1.5, alignItems: { sm: 'center' } }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder={t('Search ingredients…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="disabled" />
                    </InputAdornment>
                  ),
                  endAdornment: query ? (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label={t('clear search')} onClick={() => setQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={usage}
              onChange={(_e, val: UsageFilter | null) => val && setUsage(val)}
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="all">{t('All')}</ToggleButton>
              <ToggleButton value="inUse">{t('Used')}</ToggleButton>
              <ToggleButton value="unused">{t('Unused')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {countLabel}
          </Typography>

          {filtered.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                {t('No ingredients match your search.')}
              </Typography>
              <Button
                onClick={() => {
                  setQuery('')
                  setUsage('all')
                }}
              >
                {t('Clear filters')}
              </Button>
            </Paper>
          ) : (
            <Paper variant="outlined">
              <List sx={{ py: 0, '& ul': { p: 0 } }} subheader={<li />}>
                {groups.map(([letter, items]) => (
                  <li key={letter}>
                    <ul>
                      <ListSubheader
                        sx={{
                          top: { xs: 56, sm: 64 },
                          bgcolor: 'background.paper',
                          color: 'text.secondary',
                          fontWeight: 700,
                          lineHeight: '34px',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {letter}
                      </ListSubheader>
                      {items.map((ing) => (
                        <ListItem
                          key={ing.id}
                          dense
                          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                          secondaryAction={
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                aria-label={t('edit {name}', { name: ing.name })}
                                onClick={() => openEdit(ing)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              {/* Ingredients referenced by stock or a recipe can't be deleted
                                  (the delete would fail server-side), so disable it and explain. */}
                              <Tooltip title={deleteReason(ing, t)}>
                                <span>
                                  <IconButton
                                    size="small"
                                    aria-label={t('delete {name}', { name: ing.name })}
                                    color="error"
                                    disabled={ing.inUse}
                                    onClick={() => setToDelete(ing)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                                <Typography component="span" noWrap sx={{ minWidth: 0 }}>
                                  {ing.name}
                                </Typography>
                                {ing.alwaysInStock && (
                                  <Chip
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    icon={<AllInclusiveIcon />}
                                    label={t('Always in stock')}
                                    sx={{ flexShrink: 0 }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              ing.defaultUnit
                                ? t('Unit: {unit}', { unit: ing.defaultUnit })
                                : t('No default unit')
                            }
                            slotProps={{ secondary: { noWrap: true, variant: 'caption' } }}
                            sx={{ pr: 10 }}
                          />
                        </ListItem>
                      ))}
                    </ul>
                  </li>
                ))}
              </List>
            </Paper>
          )}
        </>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editor.open} onClose={closeEditor} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editor.editing ? t('Edit ingredient') : t('Add ingredient')}</DialogTitle>
          <DialogContent>
            <TextField
              label={t('Name')}
              fullWidth
              required
              autoFocus
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <UnitSelect
              label={t('Default unit')}
              fullWidth
              margin="normal"
              includeEmpty
              value={defaultUnit}
              onChange={setDefaultUnit}
            />
            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Switch
                  checked={alwaysInStock}
                  onChange={(e) => setAlwaysInStock(e.target.checked)}
                />
              }
              label={t('Always in stock (never runs out)')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t(
                'Staples like water or salt are always counted as available — never added to a shopping list or deducted when cooking.',
              )}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeEditor} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !name.trim()}>
              {editor.editing ? t('Save changes') : t('Add')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('Delete ingredient?')}
        message={t('“{name}” will be removed.', { name: toDelete?.name ?? '' })}
        confirmLabel={t('Delete')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
