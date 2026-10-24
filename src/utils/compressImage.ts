/**
 * 上传前压缩图片：等比缩到最长边 maxEdge，并转成 WebP（不支持时退回 JPEG）。
 *
 * 图床经本机 frp 隧道，上传体积直接决定等待时间；相机原图常见 3-10MB，
 * 先压到几百 KB 再接图床，比传完再让后端缩图快得多。
 * GIF（可能是动图）与 SVG 原样返回；PNG 的透明通道由 WebP 保留。
 */

export interface CompressImageOptions {
  /** 最长边像素，默认 1920（与后端缩图上限一致） */
  maxEdge?: number
  /** 编码质量 0-1，默认 0.85 */
  quality?: number
  /** 尺寸已在上限内且小于该字节数时跳过重编码 */
  minBytes?: number
}

const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function isRasterImageType(type: string): boolean {
  return RASTER_TYPES.has(type)
}

function loadImageElement(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

export async function compressImageFile(file: File, options: CompressImageOptions = {}): Promise<File> {
  const maxEdge = options.maxEdge ?? 1920
  const quality = options.quality ?? 0.85
  const minBytes = options.minBytes ?? 700 * 1024

  if (!isRasterImageType(file.type) || file.type === 'image/gif')
    return file

  let bitmap: ImageBitmap | null = null
  let imageEl: HTMLImageElement | null = null
  let width = 0
  let height = 0

  try {
    bitmap = await createImageBitmap(file)
    width = bitmap.width
    height = bitmap.height
  }
  catch {
    imageEl = await loadImageElement(file)
    if (!imageEl)
      return file
    width = imageEl.naturalWidth
    height = imageEl.naturalHeight
  }

  if (!width || !height) {
    bitmap?.close?.()
    return file
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  if (scale === 1 && file.size <= minBytes) {
    bitmap?.close?.()
    return file
  }

  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap?.close?.()
    return file
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (bitmap)
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  else if (imageEl)
    ctx.drawImage(imageEl, 0, 0, targetW, targetH)
  bitmap?.close?.()

  let blob = await canvasToBlob(canvas, 'image/webp', quality)
  let ext = 'webp'
  let mime = 'image/webp'
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    ext = 'jpg'
    mime = 'image/jpeg'
  }
  if (!blob)
    return file
  // 已经很小且尺寸没变时保留原图，避免二次编码反而变大。
  if (blob.size >= file.size && scale === 1)
    return file

  const base = file.name.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${base}.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  })
}
