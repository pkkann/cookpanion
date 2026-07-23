// Types mirroring API_CONTRACT.md shapes. Keep in sync with the backend contract.

export interface Household {
  id: number
  name: string
  /** Shareable code embedded in the household's invite link. */
  inviteCode: string
}

export interface User {
  id: number
  email: string
  name: string
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

export interface Ingredient {
  id: number
  name: string
  defaultUnit: string | null
  /** A pantry staple that never runs out (e.g. water) — always counts as available. */
  alwaysInStock: boolean
  // Referenced by kitchen stock or a recipe → can't be deleted. Present on
  // ingredient endpoints; may be absent when an Ingredient is nested elsewhere.
  inUse?: boolean
  /** Has a kitchen stock row. Present on ingredient endpoints. */
  usedInKitchen?: boolean
  /** Referenced by at least one recipe. Present on ingredient endpoints. */
  usedInRecipes?: boolean
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
  alwaysInStock?: boolean
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
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
  ingredients: RecipeIngredientPayload[]
}

export interface CookItem {
  ingredientId: number
  quantity: number
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
  usesIngredients: SuggestionIngredient[]
  toBuy: SuggestionIngredient[]
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
