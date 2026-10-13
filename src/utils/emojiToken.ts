/**
 * 聊天正文里的表情 token 契约：`[emoji:<emojiID>]`。
 * 后端只把它当普通文本存取（会话预览里还原成 [表情]，见 domain.StripEmojiTokens），
 * 渲染、发送、长按收藏都靠这份工具解析。改格式必须前后端一起改。
 */

export interface EmojiSegment {
  type: 'text' | 'emoji'
  text?: string
  emojiID?: number
}

const EMOJI_TOKEN_RE = /\[emoji:(\d+)\]/g

export function formatEmojiToken(emojiID: number): string {
  return `[emoji:${emojiID}]`
}

/** 把正文切成 文本 / 表情 片段，供气泡渲染。 */
export function parseEmojiSegments(content: string): EmojiSegment[] {
  const segments: EmojiSegment[] = []
  let last = 0
  const re = new RegExp(EMOJI_TOKEN_RE.source, 'g')
  let match = re.exec(content)
  while (match !== null) {
    if (match.index > last)
      segments.push({ type: 'text', text: content.slice(last, match.index) })
    segments.push({ type: 'emoji', emojiID: Number(match[1]) })
    last = match.index + match[0].length
    match = re.exec(content)
  }
  if (last < content.length)
    segments.push({ type: 'text', text: content.slice(last) })
  return segments
}

/** 联系人列表预览：token 还原成 [表情]，与后端口径一致。 */
export function stripEmojiTokens(content: string): string {
  return content.replace(EMOJI_TOKEN_RE, '[表情]')
}

/** 收集正文里出现的全部表情 ID（去重、保持出现顺序）。 */
export function collectEmojiIDs(content: string): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const segment of parseEmojiSegments(content)) {
    if (segment.type === 'emoji' && segment.emojiID && !seen.has(segment.emojiID)) {
      seen.add(segment.emojiID)
      ids.push(segment.emojiID)
    }
  }
  return ids
}
