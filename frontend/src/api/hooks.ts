import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './endpoints'
import type {
  IngredientPayload,
  RecipePayload,
  StockCreatePayload,
  StockUpdatePayload,
} from './types'

export const queryKeys = {
  ingredients: ['ingredients'] as const,
  stock: ['stock'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: number) => ['recipes', id] as const,
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

export function useUpdateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: IngredientPayload }) =>
      api.updateIngredient(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ingredients })
      qc.invalidateQueries({ queryKey: queryKeys.stock })
    },
  })
}

export function useDeleteIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteIngredient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ingredients })
      qc.invalidateQueries({ queryKey: queryKeys.stock })
    },
  })
}

// ---- Stock ----
export function useStock() {
  return useQuery({ queryKey: queryKeys.stock, queryFn: api.listStock })
}

export function useCreateStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: StockCreatePayload) => api.createStock(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stock }),
  })
}

export function useUpdateStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StockUpdatePayload }) =>
      api.updateStock(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stock }),
  })
}

export function useDeleteStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteStock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stock }),
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
