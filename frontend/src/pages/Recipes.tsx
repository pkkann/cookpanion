import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import PeopleIcon from '@mui/icons-material/People'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import RecipeFormDialog from '../components/RecipeFormDialog'
import { useNotify } from '../components/SnackbarProvider'
import { useDeleteRecipe, useRecipes } from '../api/hooks'
import type { Recipe } from '../api/types'
import { errorMessage } from '../api/client'
import { useTranslation } from 'react-i18next'

export default function Recipes() {
  const { t } = useTranslation(['recipes', 'common', 'errors'])
  const notify = useNotify()
  const navigate = useNavigate()
  const { data: recipes, isLoading, isError, error } = useRecipes()
  const deleteMut = useDeleteRecipe()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [toDelete, setToDelete] = useState<Recipe | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (recipe: Recipe) => {
    setEditing(recipe)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete.id)
      notify(t('toast.deleted'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('errors:deleteRecipe')), 'error')
    }
  }

  return (
    <Box>
      <PageHeader
        title={t('list.title')}
        subtitle={t('list.subtitle')}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('list.new')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('errors:loadRecipes'))}
        </Alert>
      )}

      {isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={180} />
          ))}
        </Box>
      ) : (recipes?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<RestaurantMenuIcon fontSize="inherit" />}
          title={t('list.emptyTitle')}
          description={t('list.emptyDescription')}
          action={
            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                {t('list.new')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/suggestions')}>
                {t('list.getAiSuggestions')}
              </Button>
            </Stack>
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {recipes!.map((recipe) => (
            <Card key={recipe.id} sx={{ display: 'flex', flexDirection: 'column' }}>
              <CardActionArea
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                sx={{ flexGrow: 1, alignItems: 'stretch' }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {recipe.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: 40,
                    }}
                  >
                    {recipe.description || t('list.noDescription')}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      icon={<PeopleIcon />}
                      label={t('list.servings', { count: recipe.servings })}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('list.ingredientsCount', { count: recipe.ingredients.length })}
                    />
                  </Stack>
                </CardContent>
              </CardActionArea>
              <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 1.5 }}>
                <IconButton
                  size="small"
                  aria-label={t('common:aria.edit')}
                  onClick={() => openEdit(recipe)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('common:aria.delete')}
                  color="error"
                  onClick={() => setToDelete(recipe)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      <RecipeFormDialog open={formOpen} recipe={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('deleteTitle')}
        message={t('deleteMessage', { title: toDelete?.title ?? '' })}
        confirmLabel={t('common:delete')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
