// Types mirroring API_CONTRACT.md shapes. Keep in sync with the backend contract.

import type { Language } from '../i18n/strings'

export interface Household {
  id: number
  name: string
  /** Shareable code embedded in the household's invite link. */
  inviteCode: string
  /** Content language for AI-generated / imported recipes and ingredients. */
  language: Language
}

export interface User {
  id: number
  email: string
  name: string
  /** The user's preferred UI/display language (follows the account across devices). */
  language: Language
  household: Household
}

export interface AuthResponse {
  token: string
  refresh_token: string
  user: User
}

export interface RefreshResponse {
  token: string
  refresh_token: string
}

/**
 * Internal recipe-line vocabulary: created implicitly by the recipe form's
 * autocomplete and AI flows. There is no ingredient management UI.
 */
export interface Ingredient {
  id: number
  name: string
  defaultUnit: string | null
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
  /** Hands-on prep time in minutes; null when not specified. */
  prepTimeMinutes: number | null
  /** Cooking time in minutes; null when not specified. */
  cookTimeMinutes: number | null
  author: RecipeAuthor
  createdAt: string
  ingredients: RecipeIngredient[]
}

export interface PlannedMeal {
  id: number
  /** Date-only ISO string, `YYYY-MM-DD`. */
  date: string
  servings: number
  recipe: Recipe
  createdAt: string
}

// ---- Request payloads ----

export interface GoogleAuthPayload {
  /** The Google Identity Services ID token from the sign-in button. */
  credential: string
}

export interface IngredientPayload {
  name: string
  defaultUnit?: string | null
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
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
  ingredients: RecipeIngredientPayload[]
}

export interface PlannedMealCreatePayload {
  recipeId: number
  /** Date-only ISO string, `YYYY-MM-DD`. */
  date: string
  servings: number
}

export interface PlannedMealUpdatePayload {
  date?: string
  servings?: number
}

// ---- AI suggestions ----

export interface SuggestPayload {
  /** How many recipes to generate. */
  count?: number
  /** Target servings every suggested recipe should be sized for. */
  servings?: number
  /** Max total time (prep + cook) in minutes; 0 or omitted means no limit. */
  maxTimeMinutes?: number
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
  prepTimeMinutes: number
  cookTimeMinutes: number
  instructions: string[]
  ingredients: SuggestionIngredient[]
}

export interface SuggestResponse {
  suggestions: RecipeSuggestion[]
}

// ---- AI recipe import ----

export interface ImportRecipePayload {
  /** Provide one. Precedence when several are set: text, then image, then url. */
  url?: string
  text?: string
  /** A base64 image data URL (e.g. a photo of a recipe). */
  image?: string
}

export interface ImportedRecipeIngredient {
  name: string
  quantity: number
  unit: string
}

/** A recipe the AI extracted from a URL or pasted text. Ingredients are name-based. */
export interface ImportedRecipe {
  title: string
  description: string
  servings: number
  prepTimeMinutes: number
  cookTimeMinutes: number
  instructions: string[]
  ingredients: ImportedRecipeIngredient[]
}

// ---- Errors ----

export interface ApiError {
  error: string
  details?: Record<string, unknown>
}
