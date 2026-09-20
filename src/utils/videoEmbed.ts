const allowedHosts = new Set(['ssemarket.cn', 'www.ssemarket.cn', 'localhost', '127.0.0.1'])

export function parseVideoReference(value: string | number): number | null {
  if (typeof value === 'number')
    return Number.isInteger(value) && value > 0 ? value : null

  const text = value.trim()
  if (/^\d+$/.test(text)) {
    const id = Number(text)
    return id > 0 ? id : null
  }

  const marker = text.lastIndexOf('/video/')
  if (marker === -1)
    return null

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      if (!allowedHosts.has(url.hostname.toLowerCase()))
        return null
    }
    catch {
      return null
    }
  }
  else if (marker !== 0) {
    return null
  }

  const rawID = text.slice(marker + '/video/'.length).replace(/\/$/, '')
  if (!/^\d+$/.test(rawID))
    return null

  const id = Number(rawID)
  return id > 0 ? id : null
}

export function videoEmbedPath(videoID: number): string {
  return `/embed/video/${videoID}`
}
