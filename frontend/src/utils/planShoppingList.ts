import type { PlannedMeal, StockItem } from '../api/types'
import { scaleQuantity } from './quantity'
import { computeAvailability } from './availability'
import { todayIso } from './date'

export interface PlanBuyItem {
  ingredientId: number
  name: string
  category: string | null
  /** Amount to buy, in `unit`. */
  shortfall: number
  unit: string
}

export interface PlanUnknownItem {
  ingredientId: number
  name: string
  unit: string
}

export interface PlanShoppingList {
  toBuy: PlanBuyItem[]
  /** Ingredients whose recipe unit can't be compared to the stocked unit. */
  unknown: PlanUnknownItem[]
}

interface Demand {
  ingredientId: number
  name: string
  category: string | null
  unit: string
  needed: number
}

/**
 * Aggregate "what to buy for the plan": sum each ingredient's demand across all
 * planned meals from today onward (scaled to each meal's servings), then
 * subtract current kitchen stock ONCE per ingredient.
 *
 * Reuses the app's shopping-list semantics: `scaleQuantity` for per-recipe
 * scaling and `computeAvailability` for the stock comparison (incl. the
 * no-cross-unit-conversion rule). Demand is grouped by `(ingredientId, unit)`
 * so e.g. "g" and "kg" of the same ingredient stay separate lines — mirroring
 * how a single stock row (one unit) can only net against the matching unit.
 */
export function planShoppingList(meals: PlannedMeal[], stock: StockItem[]): PlanShoppingList {
  const from = todayIso()
  const upcoming = meals.filter((m) => m.date >= from)

  const demand = new Map<string, Demand>()
  for (const meal of upcoming) {
    for (const ri of meal.recipe.ingredients) {
      const needed = scaleQuantity(ri.quantity, meal.recipe.servings, meal.servings)
      if (needed <= 0) continue
      const key = `${ri.ingredient.id}::${ri.unit.trim().toLowerCase()}`
      const existing = demand.get(key)
      if (existing) {
        existing.needed += needed
      } else {
        demand.set(key, {
          ingredientId: ri.ingredient.id,
          name: ri.ingredient.name,
          category: ri.ingredient.category,
          unit: ri.unit,
          needed,
        })
      }
    }
  }

  const stockById = new Map<number, StockItem>()
  for (const s of stock) stockById.set(s.ingredient.id, s)

  const toBuy: PlanBuyItem[] = []
  const unknown: PlanUnknownItem[] = []
  for (const d of demand.values()) {
    const a = computeAvailability(d.needed, d.unit, stockById.get(d.ingredientId))
    if (a.status === 'unknown') {
      unknown.push({ ingredientId: d.ingredientId, name: d.name, unit: d.unit })
    } else if (a.status === 'none' || a.status === 'partial') {
      toBuy.push({
        ingredientId: d.ingredientId,
        name: d.name,
        category: d.category,
        shortfall: a.shortfall,
        unit: d.unit,
      })
    }
  }

  toBuy.sort((x, y) => x.name.localeCompare(y.name))
  unknown.sort((x, y) => x.name.localeCompare(y.name))
  return { toBuy, unknown }
}
