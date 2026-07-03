/**
 * Split free-text instructions into discrete steps.
 *
 * Used to turn the AI's single-string instructions into an ordered list of steps
 * for display and for saving as a recipe. Handles both newline-separated text and
 * single-line numbered text like "1. Do this. 2. Do that."; leading "1." / "2)"
 * markers are stripped.
 */
export function splitInstructions(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // Prefer explicit line breaks when present.
  const byLines = trimmed
    .split(/\r?\n+/)
    .map((line) => stripLeadingMarker(line.trim()))
    .filter(Boolean)
  if (byLines.length > 1) return byLines

  // Otherwise split a single line on inline "1. " / "2) " markers. The digit must
  // be followed by a period/paren AND whitespace, so decimals like "3.5 dl" and
  // ranges like "10-15 min" stay intact.
  const byNumbers = trimmed
    .split(/\s*\d+[.)]\s+/)
    .map((step) => step.trim())
    .filter(Boolean)
  if (byNumbers.length > 1) return byNumbers

  return [stripLeadingMarker(trimmed)]
}

function stripLeadingMarker(line: string): string {
  return line.replace(/^\s*\d+[.)]\s+/, '').trim()
}
