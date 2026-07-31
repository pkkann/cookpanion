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
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import RecipeFormDialog from '../components/RecipeFormDialog'
import QuickPlanButton from '../components/QuickPlanButton'
import { useNotify } from '../components/SnackbarProvider'
import { useT } from '../i18n/LanguageProvider'
import { useDeleteRecipe, useRecipes } from '../api/hooks'
import type { Recipe } from '../api/types'
import { errorMessage } from '../api/client'
import { useAiEnabled } from '../api/config'
import { formatPrepCook } from '../utils/time'

export default function Recipes() {
  const aiEnabled = useAiEnabled()
  const notify = useNotify()
  const t = useT()
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
      notify(t('Recipe deleted'), 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, t('Could not delete recipe')), 'error')
    }
  }

  return (
    <Box>
      <PageHeader
        title={t('Recipes')}
        subtitle={t("Your household's saved recipes.")}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('New recipe')}
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, t('Failed to load recipes'))}
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
          title={t('No recipes yet')}
          description={
            aiEnabled
              ? t('Create a recipe by hand, or let the AI suggest some ideas.')
              : t('Create a recipe by hand to get started.')
          }
          action={
            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                {t('New recipe')}
              </Button>
              {aiEnabled && (
                <Button variant="outlined" onClick={() => navigate('/suggestions')}>
                  {t('Get AI suggestions')}
                </Button>
              )}
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
                    {recipe.description || t('No description')}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      icon={<PeopleIcon />}
                      label={
                        recipe.servings === 1
                          ? t('{count} serving', { count: recipe.servings })
                          : t('{count} servings', { count: recipe.servings })
                      }
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        recipe.ingredients.length === 1
                          ? t('{count} ingredient', { count: recipe.ingredients.length })
                          : t('{count} ingredients', { count: recipe.ingredients.length })
                      }
                    />
                    {formatPrepCook(recipe.prepTimeMinutes, recipe.cookTimeMinutes) && (
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<AccessTimeIcon />}
                        label={formatPrepCook(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                      />
                    )}
                  </Stack>
                </CardContent>
              </CardActionArea>
              <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 1.5 }}>
                <QuickPlanButton recipe={recipe} variant="icon" />
                <IconButton
                  size="small"
                  aria-label={t('edit')}
                  onClick={() => openEdit(recipe)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('delete')}
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
        title={t('Delete recipe?')}
        message={t('“{title}” will be permanently deleted, along with any meals planned with it.', { title: toDelete?.title ?? '' })}
        confirmLabel={t('Delete')}
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
