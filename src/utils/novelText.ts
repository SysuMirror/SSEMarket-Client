/**
 * 小说正文分段。
 *
 * 必须与后端 domain.SplitNovelParagraphs（SSE_market_server/domain/novel.go）逐条一致：
 * 换行分隔 → 去首尾空白 → 丢弃空行。段落序号即段评序号，两端不一致会导致
 * 评论挂错段落。改动任意一端时，同步跑 src/utils/novelText.test.ts。
 */

/** 与 Go strings.TrimSpace 等价的空白集（含全角空格、NBSP）。 */
const TRIM_RE = /^[\s\u0085]+|[\s\u0085]+$/g

export function splitNovelParagraphs(content: string): string[] {
  if (!content)
    return []
  const normalized = content.replace(/\r\n?/g, '\n')
  const out: string[] = []
  for (const line of normalized.split('\n')) {
    const trimmed = line.replace(TRIM_RE, '')
    if (trimmed === '')
      continue
    out.push(trimmed)
  }
  return out
}

/** 段落摘要，与后端 domain.NovelParagraphExcerpt 一致（默认 40 字 + 省略号）。 */
export function novelParagraphExcerpt(text: string, maxRunes = 40): string {
  const trimmed = text.replace(TRIM_RE, '')
  const chars = Array.from(trimmed)
  if (chars.length <= maxRunes)
    return trimmed
  return `${chars.slice(0, maxRunes).join('').replace(TRIM_RE, '')}…`
}

/** 字数口径与后端 domain.NovelWordCount 一致：不计任何空白。 */
export function novelWordCount(content: string): number {
  let count = 0
  for (const ch of content) {
    if (/\s/.test(ch))
      continue
    count++
  }
  return count
}

/** 「1.2万字」/「8620字」 */
export function formatWordCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0)
    return '0字'
  if (n < 10000)
    return `${n}字`
  const wan = n / 10000
  const text = wan >= 10 ? String(Math.round(wan)) : wan.toFixed(1).replace(/\.0$/, '')
  return `${text}万字`
}

/** 「3分钟前 / 2小时前 / 5天前 / 2026-09-14」 */
export function formatNovelTime(raw: string | null | undefined): string {
  if (!raw)
    return ''
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms))
    return String(raw).slice(0, 10)
  const diff = Date.now() - ms
  if (diff < 0)
    return new Date(ms).toLocaleDateString('zh-CN')
  const min = Math.floor(diff / 60000)
  if (min < 1)
    return '刚刚'
  if (min < 60)
    return `${min}分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24)
    return `${hour}小时前`
  const day = Math.floor(hour / 24)
  if (day <= 30)
    return `${day}天前`
  return new Date(ms).toLocaleDateString('zh-CN')
}

/** 「1.2万」阅读数 / 收藏数缩写 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0)
    return '0'
  if (n < 10000)
    return String(n)
  const wan = n / 10000
  const text = wan >= 100 ? String(Math.round(wan)) : wan.toFixed(1).replace(/\.0$/, '')
  return `${text}万`
}
