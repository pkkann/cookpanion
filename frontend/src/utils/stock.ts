import type { StockItem } from '../api/types'

/** An amount to add to the kitchen for one ingredient, in a given unit. */
export interface StockTopUp {
  ingredientId: number
  quantity: number
  unit: string
}

interface StockMutators {
  createStock: (payload: { ingredientId: number; quantity: number; unit: string }) => Promise<unknown>
  updateStock: (args: { id: number; payload: { quantity: number; unit: string } }) => Promise<unknown>
}

/**
 * Add a bought ingredient to the kitchen so it counts as on-hand. When a stock
 * row already exists we top it up by the amount (keeping its unit); an existing
 * empty row is set to the amount in the buy unit; otherwise a row is created in
 * the buy unit. Shared by the recipe detail and meal-plan shopping lists.
 */
export async function addToStock(
  item: StockTopUp,
  stockById: Map<number, StockItem>,
  { createStock, updateStock }: StockMutators,
): Promise<void> {
  const existing = stockById.get(item.ingredientId)
  if (existing && existing.quantity > 0) {
    await updateStock({
      id: existing.id,
      payload: { quantity: existing.quantity + item.quantity, unit: existing.unit },
    })
  } else if (existing) {
    await updateStock({ id: existing.id, payload: { quantity: item.quantity, unit: item.unit } })
  } else {
    await createStock({ ingredientId: item.ingredientId, quantity: item.quantity, unit: item.unit })
  }
}
