// Types mirroring API_CONTRACT.md shapes. Keep in sync with the backend contract.

import type { Language } from '../i18n/config'

export interface Household {
  id: number
  name: string
}

export interface User {
  id: number
  email: string
  name: string
  locale: Language
  household: Household
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Ingredient {
  id: number
  name: string
  category: string | null
  defaultUnit: string | null
}

export interface StockItem {
  id: number
  ingredient: Ingredient
  quantity: number
  unit: string
}

export interface RecipeIngredient {
  ingredient: Ingredient
  quantity: number
  unit: string
}

export interface RecipeAuthor {
  id: number
  name: string
}

export interface Recipe {
  id: number
  title: string
  description: string
  instructions: string[]
  servings: number
  author: RecipeAuthor
  createdAt: string
  ingredients: RecipeIngredient[]
}

// ---- Request payloads ----

export interface RegisterPayload {
  email: string
  password: string
  name: string
  householdName: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface IngredientPayload {
  name: string
  category?: string | null
  defaultUnit?: string | null
}

export interface StockCreatePayload {
  ingredientId: number
  quantity: number
  unit: string
}

export interface StockUpdatePayload {
  quantity: number
  unit: string
}

export interface RecipeIngredientPayload {
  ingredientId: number
  quantity: number
  unit: string
}

export interface RecipePayload {
  title: string
  description: string
  instructions: string[]
  servings: number
  ingredients: RecipeIngredientPayload[]
}

export interface CookItem {
  ingredientId: number
  quantity: number
}

export interface CookPayload {
  items: CookItem[]
}

// ---- AI suggestions ----

export type SuggestMode = 'kitchen' | 'all' | 'surprise'

export interface SuggestPayload {
  mode: SuggestMode
  /** How many recipes to generate. */
  count?: number
  maxToBuy: number
  /** Target ingredients per recipe; used in "surprise" mode. */
  numIngredients?: number
  preferences?: string
}

export interface SuggestionIngredient {
  name: string
  quantity: number
  unit: string
}

export interface RecipeSuggestion {
  title: string
  description: string
  servings: number
  instructions: string
  usesIngredients: SuggestionIngredient[]
  toBuy: SuggestionIngredient[]
}

export interface SuggestResponse {
  suggestions: RecipeSuggestion[]
}

// ---- Errors ----

export interface ApiError {
  error: string
  details?: Record<string, unknown>
}
