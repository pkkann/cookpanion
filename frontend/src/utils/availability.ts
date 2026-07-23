import type { StockItem } from '../api/types'

export type AvailabilityStatus = 'enough' | 'partial' | 'none' | 'unknown' | 'always'

export interface Availability {
  status: AvailabilityStatus
  /** Stock quantity for the ingredient (0 when not in kitchen). */
  have: number
  /** Stock unit (empty when not in kitchen). */
  haveUnit: string
  /**
   * How much more is needed, in the recipe's unit:
   * - partial: needed - have
   * - none:    needed (full amount)
   * - enough/unknown: 0
   */
  shortfall: number
}

/** Case-insensitive, trimmed unit comparison. No cross-unit conversion. */
export function unitsComparable(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Compare the scaled amount a recipe needs against what's in the kitchen.
 * `needed` is already scaled for the chosen servings; `recipeUnit` is the
 * recipe ingredient's unit; `stock` is the matched StockItem (by ingredient id)
 * or undefined when there's no stock row.
 */
export function computeAvailability(
  needed: number,
  recipeUnit: string,
  stock: StockItem | undefined,
  alwaysInStock = false,
): Availability {
  // A pantry staple (water, salt, …) is treated as never running out, so it's
  // always available regardless of any stock row or unit.
  if (alwaysInStock) {
    return { status: 'always', have: 0, haveUnit: '', shortfall: 0 }
  }

  const have = stock?.quantity ?? 0
  const haveUnit = stock?.unit ?? ''

  // No stock row, or nothing on hand → must buy the full amount.
  if (!stock || have <= 0) {
    return { status: 'none', have: 0, haveUnit: '', shortfall: needed }
  }

  // Stock exists but units can't be compared → don't guess a conversion.
  if (!unitsComparable(recipeUnit, haveUnit)) {
    return { status: 'unknown', have, haveUnit, shortfall: 0 }
  }

  if (have >= needed) {
    return { status: 'enough', have, haveUnit, shortfall: 0 }
  }

  return { status: 'partial', have, haveUnit, shortfall: needed - have }
}
