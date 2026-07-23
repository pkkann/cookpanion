/** Browser helpers for preparing a captured photo before upload. */

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = src
  })
}

/**
 * Downscales an image file to fit within `maxDim` on its longest edge and
 * re-encodes it as a JPEG data URL. This bounds the upload size and normalizes
 * away formats the vision model may not accept (e.g. iPhone HEIC). Falls back to
 * the original data URL if the canvas isn't available.
 */
export async function fileToDownscaledJpeg(file: File, maxDim = 1568, quality = 0.8): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const longest = Math.max(img.width, img.height)
  const scale = longest > maxDim ? maxDim / longest : 1
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', quality)
}
