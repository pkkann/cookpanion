import { api } from './client'
import type {
  AuthResponse,
  ImportedRecipe,
  ImportRecipePayload,
  Ingredient,
  IngredientPayload,
  PlannedMeal,
  PlannedMealCreatePayload,
  PlannedMealUpdatePayload,
  Recipe,
  RecipePayload,
  SuggestPayload,
  SuggestResponse,
  User,
} from './types'
import type { Language } from '../i18n/strings'

// ---- Auth ----
export async function googleAuth(credential: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google', { credential })
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/login', { email, password })
  return data
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/register', { name, email, password })
  return data
}

/** Set (or replace) the signed-in user's password, enabling email/password login. */
export async function setPassword(password: string): Promise<void> {
  await api.post('/me/password', { password })
}

/** Best-effort server-side revocation of the refresh token on sign-out. */
export async function logout(refreshToken: string): Promise<void> {
  await api.post('/logout', { refresh_token: refreshToken })
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/me')
  return data
}

/** Update the current user's preferred display language. Returns the updated user. */
export async function updateMe(payload: { language: Language }): Promise<User> {
  const { data } = await api.patch<User>('/me', payload)
  return data
}

/** Rename the current user's household. Returns the updated user. */
export async function updateHousehold(name: string): Promise<User> {
  const { data } = await api.patch<User>('/household', { name })
  return data
}

/** Set the household's content language (steers AI + imports). Returns the updated user. */
export async function updateHouseholdLanguage(language: Language): Promise<User> {
  const { data } = await api.patch<User>('/household', { language })
  return data
}

/** Join the household with the given invite code. Returns the updated user. */
export async function joinHousehold(code: string): Promise<User> {
  const { data } = await api.post<User>('/household/join', { code })
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

// ---- AI recipe import ----
export async function importRecipe(payload: ImportRecipePayload): Promise<ImportedRecipe> {
  const { data } = await api.post<{ recipe: ImportedRecipe }>('/ai/import-recipe', payload)
  return data.recipe
}

/** Re-translate all recipes & ingredient names into the household's content language. */
export async function retranslateContent(): Promise<{ recipes: number; ingredients: number }> {
  const { data } = await api.post<{ recipes: number; ingredients: number }>('/ai/retranslate')
  return data
}

