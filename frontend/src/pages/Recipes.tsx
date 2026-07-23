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
import QuickPlanButton from '../components/QuickPlanButton'
import { useNotify } from '../components/SnackbarProvider'
import { useDeleteRecipe, useRecipes } from '../api/hooks'
import type { Recipe } from '../api/types'
import { errorMessage } from '../api/client'

export default function Recipes() {
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
      notify('Recipe deleted', 'success')
      setToDelete(null)
    } catch (err) {
      notify(errorMessage(err, 'Could not delete recipe'), 'error')
    }
  }

  return (
    <Box>
      <PageHeader
        title="Recipes"
        subtitle="Your household's saved recipes."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New recipe
          </Button>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage(error, 'Failed to load recipes')}
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
          title="No recipes yet"
          description="Create a recipe by hand, or let the AI suggest recipes based on your kitchen."
          action={
            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                New recipe
              </Button>
              <Button variant="outlined" onClick={() => navigate('/suggestions')}>
                Get AI suggestions
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
                    {recipe.description || 'No description'}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      icon={<PeopleIcon />}
                      label={
                        recipe.servings === 1
                          ? `${recipe.servings} serving`
                          : `${recipe.servings} servings`
                      }
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        recipe.ingredients.length === 1
                          ? `${recipe.ingredients.length} ingredient`
                          : `${recipe.ingredients.length} ingredients`
                      }
                    />
                  </Stack>
                </CardContent>
              </CardActionArea>
              <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 1.5 }}>
                <QuickPlanButton recipe={recipe} variant="icon" />
                <IconButton
                  size="small"
                  aria-label="edit"
                  onClick={() => openEdit(recipe)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="delete"
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
        title="Delete recipe?"
        message={`“${toDelete?.title ?? ''}” will be permanently deleted, along with any meals planned with it.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
