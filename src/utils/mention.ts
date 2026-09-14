/**
 * @ 提及解析(业界成熟做法:贪婪捕获 + 已知用户表跨空格最长匹配)
 *
 * 旧实现用「标点黑名单」圈昵称边界,昵称含 . ( ) ！ 等字符时捕获中途截断;
 * 且昵称含空格(如 "Donald J. Trump")、@ 后多打了空格时正则彻底无解。
 * 新实现(渲染期扫描器):
 *   1. 逐字符扫描文本(跳过 HTML 标签内部),遇到 @ 后允许至多一个空格,
 *      再与已知用户表(后端精确解析所得 nameToUserId)做最长前缀匹配——
 *      昵称可含任意字符与空格,匹配后要求边界(空白/标点/中文字符/结尾)防误链
 *   2. 未命中时按旧行为对「@+连续非边界字符」做灰色高亮
 * 解析期(parseMentionTokens)按空格分词生成多词候选喂后端,兼容含空格昵称。
 */

/** 贪婪捕获:@ 后连续的任何非空白、非 @、非 < 字符(用于兼容导出与未知高亮) */
const MENTION_CAPTURE = String.raw`@([^\s@<]+)`

export const MENTION_PATTERN = new RegExp(MENTION_CAPTURE, 'g')

/** 边界标点集合(中英文):名称后紧跟这些字符即视为名称结束 */
const PUNCT_RE = /[，。！？、；：“”‘’（）【】《》…～·,.!?;:\])}:]/

const TRAILING_PUNCT_RE = /[，。！？、；：“”‘’（）【】《》…～·,.!?;:\])}:]+$/

/** 名称结束的边界判定:结尾/空白/HTML标签起始/中英文标点/中文字符(中文前自然断词) */
function isBoundaryChar(ch: string | undefined): boolean {
  if (ch === undefined || ch === '')
    return true
  if (ch === '<' || ch === '>')
    return true
  if (/\s/.test(ch))
    return true
  if (PUNCT_RE.test(ch))
    return true
  // CJK 表意文字:拉丁名后紧贴中文视为边界(如 "@Donald J. Trump你好")
  return /[一-鿿㐀-䶿]/.test(ch)
}

/** 已知用户表按昵称长度降序(最长前缀优先命中) */
function knownNamesSorted(nameToUserId: Record<string, number>): string[] {
  return Object.keys(nameToUserId)
    .filter(n => n && nameToUserId[n] > 0)
    .sort((a, b) => b.length - a.length)
}

/** 解析阶段候选昵称:全量 + 每个标点前/后各切一刀(去重,长名优先) */
export function mentionCandidates(captured: string): string[] {
  const cur = captured.trim()
  if (!cur)
    return []
  const set = new Set<string>([cur])
  for (let i = 0; i < cur.length; i++) {
    if (PUNCT_RE.test(cur[i])) {
      set.add(cur.slice(0, i))
      set.add(cur.slice(0, i + 1))
    }
  }
  return [...set]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
}

/**
 * 解析出内容里全部待查询的候选昵称(去重)。
 * 兼容含空格昵称:取 @ 后至多 4 个空格分隔的词,逐级累积拼接为候选,
 * 并对每个累积候选追加「剥尾部标点」变体(应对紧贴标点)。
 */
export function parseMentionTokens(content: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (s: string) => {
    const t = s.trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  let i = 0
  while ((i = content.indexOf('@', i)) !== -1) {
    let j = i + 1
    if (content[j] === ' ')
      j++
    const words = content.slice(j).split(/\s+/).slice(0, 4).filter(Boolean)
    for (let n = 1; n <= words.length; n++) {
      const joined = words.slice(0, n).join(' ')
      push(joined)
      const cut = joined.replace(TRAILING_PUNCT_RE, '')
      if (cut !== joined)
        push(cut)
    }
    i = j
  }
  return out
}

/**
 * 在(已渲染的)HTML 中注入 @ 高亮:已知用户 → 可点击链接;
 * 未知 → 灰色高亮。跳过 HTML 标签内部与 pre/code 块。
 * 注意入参为 HTML 片段,匹配到的原文原样输出(不做二次转义,避免 &amp; 双重编码)。
 */
export function injectMentionHighlightHTML(
  content: string,
  nameToUserId: Record<string, number> = {},
): string {
  const known = knownNamesSorted(nameToUserId)
  let out = ''
  let i = 0
  let inTag = false
  while (i < content.length) {
    const ch = content[i]
    if (ch === '<') {
      inTag = true
      out += ch
      i++
      continue
    }
    if (ch === '>') {
      inTag = false
      out += ch
      i++
      continue
    }
    if (ch === '@' && !inTag) {
      let j = i + 1
      if (content[j] === ' ')
        j++
      let matched = ''
      for (const name of known) {
        if (content.startsWith(name, j) && isBoundaryChar(content[j + name.length])) {
          matched = name
          break
        }
      }
      if (matched) {
        out += `<span class="md-mention md-mention--link" data-user-id="${nameToUserId[matched]}" role="link" tabindex="0">${content.slice(i, j + matched.length)}</span>`
        i = j + matched.length
        continue
      }
      // 未命中:灰色高亮到首个边界字符(与旧行为观感一致)
      let k = j
      while (k < content.length && !isBoundaryChar(content[k]))
        k++
      if (k > j) {
        out += `<span class="md-mention">${content.slice(i, k)}</span>`
        i = k
        continue
      }
      // @ 后紧跟边界(如「@。」):原样输出
    }
    out += ch
    i++
  }
  return out
}

/** 在已渲染 HTML 中注入 @ 高亮，跳过 pre/code 块 */
export function injectMentionsInRenderedHTML(
  html: string,
  nameToUserId: Record<string, number> = {},
): string {
  if (!html || !Object.keys(nameToUserId).length)
    return injectMentionHighlightHTML(html, nameToUserId)
  const segments = html.split(/(<(?:pre|code)\b[^>]*>[\s\S]*?<\/(?:pre|code)>)/gi)
  return segments.map((part, index) => {
    if (index % 2 === 1)
      return part
    return injectMentionHighlightHTML(part, nameToUserId)
  }).join('')
}

/** 编辑器插入提及:统一「@昵称 + 空格」形式,空格即天然边界 */
export function buildMentionPrefix(displayName: string): string {
  const name = displayName.trim()
  if (!name)
    return ''
  return `@${name} `
}
