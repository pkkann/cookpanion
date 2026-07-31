import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './endpoints'
import type {
  IngredientPayload,
  PlannedMealCreatePayload,
  PlannedMealUpdatePayload,
  RecipePayload,
} from './types'

export const queryKeys = {
  ingredients: ['ingredients'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: number) => ['recipes', id] as const,
  plannedMeals: ['plannedMeals'] as const,
}

// ---- Ingredients ----
export function useIngredients() {
  return useQuery({ queryKey: queryKeys.ingredients, queryFn: api.listIngredients })
}

export function useCreateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IngredientPayload) => api.createIngredient(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ingredients }),
  })
}

// ---- Recipes ----
export function useRecipes() {
  return useQuery({ queryKey: queryKeys.recipes, queryFn: api.listRecipes })
}

export function useRecipe(id: number) {
  return useQuery({
    queryKey: queryKeys.recipe(id),
    queryFn: () => api.getRecipe(id),
    enabled: Number.isFinite(id) && id > 0,
  })
}

export function useCreateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecipePayload) => api.createRecipe(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recipes }),
  })
}

export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RecipePayload }) =>
      api.updateRecipe(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.recipes })
      qc.invalidateQueries({ queryKey: queryKeys.recipe(id) })
    },
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteRecipe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recipes }),
  })
}

// ---- AI recipe import ----
export function useImportRecipe() {
  return useMutation({ mutationFn: api.importRecipe })
}

// ---- AI: re-translate all content into the household language ----
export function useRetranslateContent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.retranslateContent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recipes })
      qc.invalidateQueries({ queryKey: queryKeys.ingredients })
      qc.invalidateQueries({ queryKey: queryKeys.plannedMeals })
    },
  })
}

// ---- Meal plan ----
export function usePlannedMeals() {
  return useQuery({ queryKey: queryKeys.plannedMeals, queryFn: api.listPlannedMeals })
}

export function useCreatePlannedMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PlannedMealCreatePayload) => api.createPlannedMeal(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.plannedMeals }),
  })
}

export function useUpdatePlannedMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PlannedMealUpdatePayload }) =>
      api.updatePlannedMeal(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.plannedMeals }),
  })
}

export function useDeletePlannedMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deletePlannedMeal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.plannedMeals }),
  })
}
