// Canonical unit values stored on ingredients, stock items and recipe lines.
// Kept intentionally small; labels are localized via the `common:units` namespace.
export const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup'] as const

export type Unit = (typeof UNIT_OPTIONS)[number]
