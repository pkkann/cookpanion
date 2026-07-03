/**
 * Format a numeric quantity for display: round to at most 2 decimals and
 * strip trailing zeros, so scaled values read cleanly (e.g. 3.0000001 -> "3",
 * 66.666 -> "66.67", 300 -> "300").
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  // parseFloat drops trailing zeros ("3.00" -> 3); avoid "-0".
  const normalized = parseFloat(rounded.toFixed(2))
  return String(Object.is(normalized, -0) ? 0 : normalized)
}

/**
 * Scale an ingredient quantity from a recipe's stored serving count to the
 * chosen one. Guards against a zero/invalid stored serving count (legacy data)
 * by returning the original quantity unscaled.
 */
export function scaleQuantity(
  quantity: number,
  baseServings: number,
  chosenServings: number,
): number {
  if (!Number.isFinite(baseServings) || baseServings <= 0) return quantity
  return quantity * (chosenServings / baseServings)
}
