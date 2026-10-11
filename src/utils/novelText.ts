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

/** 正文图片支持的扩展名（裸链接自动识别时用），与后端 domain.novelImageExts 一致。 */
const NOVEL_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp']

/**
 * 一眼就不是图片的后缀，与后端 domain.novelNonImageExts 一致。
 * Markdown 图片语法里作者已经写明「这是一张图」，而图床返回的 URL 常常没有扩展名，
 * 所以那种写法只排除这些明确的非图片文件。
 */
const NOVEL_NON_IMAGE_EXTS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.csv',
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.flac',
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.zip',
  '.rar',
  '.7z',
  '.gz',
  '.tar',
  '.exe',
  '.apk',
  '.js',
  '.json',
  '.html',
  '.htm',
]

/** 归一化并校验链接形态：无空白、必须是 http(s):// 或协议相对 //。返回小写形态。 */
function normalizeNovelURL(raw: string): string | null {
  const u = raw.trim()
  if (!u || /\s/.test(u))
    return null
  const lower = u.toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('//'))
    return null
  return lower
}

/** 去掉 query / fragment，图床常带 ?x-oss-process=...。 */
function novelURLPath(lower: string): string {
  const cut = lower.search(/[?#]/)
  return cut >= 0 ? lower.slice(0, cut) : lower
}

function isNovelImageURL(raw: string): boolean {
  const lower = normalizeNovelURL(raw)
  if (lower === null)
    return false
  const path = novelURLPath(lower)
  return NOVEL_IMAGE_EXTS.some(ext => path.endsWith(ext))
}

function isNovelMarkdownImageURL(raw: string): boolean {
  const lower = normalizeNovelURL(raw)
  if (lower === null)
    return false
  const path = novelURLPath(lower)
  return !NOVEL_NON_IMAGE_EXTS.some(ext => path.endsWith(ext))
}

/**
 * 段落是否为「图片段落」，是则返回图片 URL。
 * 与后端 domain.NovelParagraphImage 一致：整段只有 ![说明](url) 或一个图片直链才算。
 * Markdown 写法允许无扩展名的图床链接；裸直链必须带图片扩展名。
 */
export function novelParagraphImage(text: string): string {
  const s = text.replace(TRIM_RE, '')
  if (!s)
    return ''
  if (s.startsWith('![')) {
    const i = s.indexOf('](')
    if (i < 0)
      return ''
    const rest = s.slice(i + 2)
    const end = rest.lastIndexOf(')')
    if (end < 0)
      return ''
    let url = rest.slice(0, end).trim()
    // ![alt](url "标题")：只取第一个空格前的 URL。
    const space = url.search(/\s/)
    if (space >= 0)
      url = url.slice(0, space).trim()
    return isNovelMarkdownImageURL(url) ? url : ''
  }
  return isNovelImageURL(s) ? s : ''
}

/** 段落摘要，与后端 domain.NovelParagraphExcerpt 一致（默认 40 字 + 省略号）。 */
export function novelParagraphExcerpt(text: string, maxRunes = 40): string {
  const trimmed = text.replace(TRIM_RE, '')
  if (novelParagraphImage(trimmed) !== '')
    return '[图片]'
  const chars = Array.from(trimmed)
  if (chars.length <= maxRunes)
    return trimmed
  return `${chars.slice(0, maxRunes).join('').replace(TRIM_RE, '')}…`
}

/** 正文字数（图片段落不计入），与后端 domain.NovelContentWordCount 一致。 */
export function novelContentWordCount(content: string): number {
  let total = 0
  for (const p of splitNovelParagraphs(content)) {
    if (novelParagraphImage(p) !== '')
      continue
    total += novelWordCount(p)
  }
  return total
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
