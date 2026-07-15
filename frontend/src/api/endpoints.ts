import { api } from './client'
import type {
  AuthResponse,
  CookPayload,
  RecipeTranslation,
  Ingredient,
  IngredientPayload,
  PlannedMeal,
  PlannedMealCreatePayload,
  PlannedMealUpdatePayload,
  Recipe,
  RecipePayload,
  StockCreatePayload,
  StockItem,
  StockUpdatePayload,
  SuggestPayload,
  SuggestResponse,
  User,
} from './types'
import type { Language } from '../i18n/config'

// ---- Auth ----
export async function googleAuth(credential: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google', { credential })
  return data
}

/** Best-effort server-side revocation of the refresh token on sign-out. */
export async function logout(refreshToken: string): Promise<void> {
  await api.post('/logout', { refresh_token: refreshToken })
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/me')
  return data
}

export async function updateMe(payload: { locale: Language }): Promise<User> {
  const { data } = await api.patch<User>('/me', payload)
  return data
}

// ---- Ingredients ----
export async function listIngredients(): Promise<Ingredient[]> {
  const { data } = await api.get<Ingredient[]>('/ingredients')
  return data
}

export async function createIngredient(payload: IngredientPayload): Promise<Ingredient> {
  const { data } = await api.post<Ingredient>('/ingredients', payload)
  return data
}

export async function updateIngredient(
  id: number,
  payload: IngredientPayload,
): Promise<Ingredient> {
  const { data } = await api.put<Ingredient>(`/ingredients/${id}`, payload)
  return data
}

export async function deleteIngredient(id: number): Promise<void> {
  await api.delete(`/ingredients/${id}`)
}

// ---- Kitchen stock ----
export async function listStock(): Promise<StockItem[]> {
  const { data } = await api.get<StockItem[]>('/stock')
  return data
}

export async function createStock(payload: StockCreatePayload): Promise<StockItem> {
  const { data } = await api.post<StockItem>('/stock', payload)
  return data
}

// Returns the updated item, or nothing (204) when the update empties the row
// and the backend deletes it. Callers refetch the stock list rather than using
// the return value.
export async function updateStock(
  id: number,
  payload: StockUpdatePayload,
): Promise<StockItem | void> {
  const { data } = await api.put<StockItem>(`/stock/${id}`, payload)
  return data
}

export async function deleteStock(id: number): Promise<void> {
  await api.delete(`/stock/${id}`)
}

// ---- Recipes ----
export async function listRecipes(): Promise<Recipe[]> {
  const { data } = await api.get<Recipe[]>('/recipes')
  return data
}

export async function getRecipe(id: number): Promise<Recipe> {
  const { data } = await api.get<Recipe>(`/recipes/${id}`)
  return data
}

export async function createRecipe(payload: RecipePayload): Promise<Recipe> {
  const { data } = await api.post<Recipe>('/recipes', payload)
  return data
}

export async function updateRecipe(id: number, payload: RecipePayload): Promise<Recipe> {
  const { data } = await api.put<Recipe>(`/recipes/${id}`, payload)
  return data
}

export async function deleteRecipe(id: number): Promise<void> {
  await api.delete(`/recipes/${id}`)
}

export async function cookRecipe(id: number, payload: CookPayload): Promise<StockItem[]> {
  const { data } = await api.post<StockItem[]>(`/recipes/${id}/cook`, payload)
  return data
}

export async function translateRecipe(id: number, locale: string): Promise<RecipeTranslation> {
  const { data } = await api.post<RecipeTranslation>(`/recipes/${id}/translate`, { locale })
  return data
}

// ---- Meal plan (planned meals) ----
export async function listPlannedMeals(): Promise<PlannedMeal[]> {
  const { data } = await api.get<PlannedMeal[]>('/planned-meals')
  return data
}

export async function createPlannedMeal(payload: PlannedMealCreatePayload): Promise<PlannedMeal> {
  const { data } = await api.post<PlannedMeal>('/planned-meals', payload)
  return data
}

export async function updatePlannedMeal(
  id: number,
  payload: PlannedMealUpdatePayload,
): Promise<PlannedMeal> {
  const { data } = await api.put<PlannedMeal>(`/planned-meals/${id}`, payload)
  return data
}

export async function deletePlannedMeal(id: number): Promise<void> {
  await api.delete(`/planned-meals/${id}`)
}

// ---- AI suggestions ----
export async function suggestRecipes(payload: SuggestPayload): Promise<SuggestResponse> {
  const { data } = await api.post<SuggestResponse>('/ai/suggest-recipes', payload)
  return data
}
