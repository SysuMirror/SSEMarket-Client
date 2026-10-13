/** 小说专区路由：集中生成路径，避免各处硬编码字符串。 */

export function novelZonePath(query: Record<string, string> = {}) {
  return { path: '/novel', query }
}

export function novelShelfPath() {
  return { path: '/novel', query: { tab: 'shelf' } }
}

export function novelBookPath(novelID: number) {
  return { path: `/novel/book/${novelID}` }
}

export function novelReadPath(chapterID: number) {
  return { path: `/novel/read/${chapterID}` }
}

export function novelWritePath(novelID?: number) {
  if (novelID && novelID > 0)
    return { path: '/novel/write', query: { novel: String(novelID) } }
  return { path: '/novel/write' }
}

/** 从 /novel/read/:chapterID 之类的路径里取章节 ID，非法返回 0。 */
export function parseNovelID(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}
