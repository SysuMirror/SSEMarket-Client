/** @ 昵称边界：空格、行末、HTML 标签、常见中英文标点 */
const MENTION_TAIL = String.raw`(?:\s|$|<|[\r\n]|[，。！？、；：""''（）【】《》…,.!?;:\])}])`
const MENTION_NAME = String.raw`[^\s@<，。！？、；：""''（）【】《》…,.!?;:\])}]+`

/** 评论 @ 提及：昵称须与用户 name 全量相等 */
export const MENTION_PATTERN = new RegExp(`@(${MENTION_NAME})(?=${MENTION_TAIL})`, 'g')

export function parseMentionTokens(content: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const re = new RegExp(MENTION_PATTERN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const name = (m[1] ?? '').trim()
    if (!name || seen.has(name))
      continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function injectMentionHighlightHTML(
  content: string,
  nameToUserId: Record<string, number> = {},
): string {
  return content.replace(MENTION_PATTERN, (match, name: string) => {
    const userId = nameToUserId[name]
    if (userId && userId > 0) {
      return `<span class="md-mention md-mention--link" data-user-id="${userId}" role="link" tabindex="0">${escapeHtml(match)}</span>`
    }
    return `<span class="md-mention">${escapeHtml(match)}</span>`
  })
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

export function buildMentionPrefix(displayName: string): string {
  const name = displayName.trim()
  if (!name)
    return ''
  return `@${name} `
}
