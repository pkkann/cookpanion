import { api } from './client'
import type {
  AuthResponse,
  Ingredient,
  IngredientPayload,
  LoginPayload,
  Recipe,
  RecipePayload,
  RegisterPayload,
  StockCreatePayload,
  StockItem,
  StockUpdatePayload,
  SuggestPayload,
  SuggestResponse,
  User,
} from './types'
import type { Language } from '../i18n/config'

// ---- Auth ----
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/register', payload)
  return data
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/login', payload)
  return data
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

export async function updateStock(id: number, payload: StockUpdatePayload): Promise<StockItem> {
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

// ---- AI suggestions ----
export async function suggestRecipes(payload: SuggestPayload): Promise<SuggestResponse> {
  const { data } = await api.post<SuggestResponse>('/ai/suggest-recipes', payload)
  return data
}
