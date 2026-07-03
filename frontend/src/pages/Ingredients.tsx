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
import { useTranslation } from 'react-i18next'

interface EditorState {
  open: boolean
  editing: Ingredient | null
}

export default function Ingredients() {
  const { t } = useTranslation(['ingredients', 'common', 'errors'])
  const notify = useNotify()
  const { data: ingredients, isLoading, isError, error } = useIngredients()
  const createMut = useCreateIngredient()
  const updateMut = useUpdateIngredient()
  const deleteMut = useDeleteIngredient()

  const [editor, setEditor] = useState<EditorState>({ open: false, editing: null })
  const [toDelete, setToDelete] = useState<Ingredient | null>(null)

  // form fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [defaultUnit, setDefaultUnit] = useState('')

  const openCreate = () => {
    setName('')
    setCategory('')
    setDefaultUnit('')
    setEditor({ open: true, editing: null })
  }

  const openEdit = (ing: Ingredient) => {
    setName(ing.name)
    setCategory(ing.category ?? '')
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
        // On edit the user can override the category by hand.
        await updateMut.mutateAsync({
          id: editor.editing.id,
          payload: {
            name: trimmedName,
            category: category.trim() || null,
            defaultUnit: defaultUnit.trim() || null,
          },
        })
        notify(t('toast.updated'), 'success')
      } else {
        // On create, omit category so the backend assigns it via AI.
        await createMut.mutateAsync({
          name: trimmedName,
          defaultUnit: defaultUnit.trim() || null,
        })
        notify(t('toast.added'), 'success')
      }
      closeEditor()
    } catch (err) {
      notify(errorMessage(err, t('errors:saveIngredient')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify(t('toast.deleted'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('errors:deleteIngredient')), 'error')
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
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('add')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('errors:loadIngredients'))}
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
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              {t('addFirst')}
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
                    {ing.category && <Chip size="small" label={ing.category} />}
                    {ing.defaultUnit && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('unitChip', { unit: ing.defaultUnit })}
                      />
                    )}
                  </Stack>
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    aria-label={t('common:aria.edit')}
                    onClick={() => openEdit(ing)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('common:aria.delete')}
                    color="error"
                    onClick={() => setToDelete(ing)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editor.open} onClose={closeEditor} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editor.editing ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              label={t('name')}
              fullWidth
              required
              autoFocus
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {editor.editing ? (
              <TextField
                label={t('category')}
                fullWidth
                margin="normal"
                placeholder={t('categoryPlaceholder')}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {t('categoryAutoHint')}
              </Typography>
            )}
            <UnitSelect
              label={t('defaultUnit')}
              fullWidth
              margin="normal"
              includeEmpty
              value={defaultUnit}
              onChange={setDefaultUnit}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeEditor} disabled={saving}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !name.trim()}>
              {editor.editing ? t('common:saveChanges') : t('common:add')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('deleteTitle')}
        message={t('deleteMessage', { name: toDelete?.name ?? '' })}
        confirmLabel={t('common:delete')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
