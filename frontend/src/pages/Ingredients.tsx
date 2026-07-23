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
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
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

interface EditorState {
  open: boolean
  editing: Ingredient | null
}

export default function Ingredients() {
  const notify = useNotify()
  const isMobile = useIsMobile()
  const { data: ingredients, isLoading, isError, error } = useIngredients()
  const createMut = useCreateIngredient()
  const updateMut = useUpdateIngredient()
  const deleteMut = useDeleteIngredient()

  const [editor, setEditor] = useState<EditorState>({ open: false, editing: null })
  const [toDelete, setToDelete] = useState<Ingredient | null>(null)

  // form fields
  const [name, setName] = useState('')
  const [defaultUnit, setDefaultUnit] = useState('')

  const openCreate = () => {
    setName('')
    setDefaultUnit('')
    setEditor({ open: true, editing: null })
  }

  const openEdit = (ing: Ingredient) => {
    setName(ing.name)
    setDefaultUnit(ing.defaultUnit ?? '')
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
          },
        })
        notify('Ingredient updated', 'success')
      } else {
        await createMut.mutateAsync({
          name: trimmedName,
          defaultUnit: defaultUnit.trim() || null,
        })
        notify('Ingredient added', 'success')
      }
      closeEditor()
    } catch (err) {
      notify(errorMessage(err, 'Could not save ingredient'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify('Ingredient deleted', 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, 'Could not delete ingredient'), 'error')
    }
  }

  const sorted = useMemo(
    () => [...(ingredients ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients],
  )

  const saving = createMut.isPending || updateMut.isPending

  return (
    <Box>
      <PageHeader
        title="Ingredients"
        subtitle="The building blocks your household cooks with."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add ingredient
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, 'Failed to load ingredients')}
        </Alert>
      )}

      {isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={72} />
          ))}
        </Stack>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<LocalDiningIcon fontSize="inherit" />}
          title="No ingredients yet"
          description="Add the ingredients your household uses so you can track stock and build recipes."
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add your first ingredient
            </Button>
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
          }}
        >
          {sorted.map((ing) => (
            <Card key={ing.id} variant="outlined">
              <CardContent
                sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                    {ing.name}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
                    {ing.defaultUnit && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`unit: ${ing.defaultUnit}`}
                      />
                    )}
                  </Stack>
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    aria-label="edit"
                    onClick={() => openEdit(ing)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {/* Ingredients referenced by stock or a recipe can't be
                      deleted (the delete would fail server-side), so disable it
                      and explain why. */}
                  <Tooltip title={ing.inUse ? 'In use by a recipe or your kitchen stock' : ''}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label="delete"
                        color="error"
                        disabled={ing.inUse}
                        onClick={() => setToDelete(ing)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editor.open} onClose={closeEditor} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editor.editing ? 'Edit ingredient' : 'Add ingredient'}</DialogTitle>
          <DialogContent>
            <TextField
              label="Name"
              fullWidth
              required
              autoFocus
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <UnitSelect
              label="Default unit"
              fullWidth
              margin="normal"
              includeEmpty
              value={defaultUnit}
              onChange={setDefaultUnit}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !name.trim()}>
              {editor.editing ? 'Save changes' : 'Add'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete ingredient?"
        message={`“${toDelete?.name ?? ''}” will be removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
