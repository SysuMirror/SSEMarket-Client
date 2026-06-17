/** 评论 @ 提及：@昵称 后须为空格或行末，昵称须与用户 name 全量相等 */
const MENTION_PATTERN = /@([^\s@]+)(?=\s|$)/g

export function injectMentionHighlightHTML(content: string): string {
  return content.replace(MENTION_PATTERN, (match) => {
    return `<span class="md-mention">${match}</span>`
  })
}

export function buildMentionPrefix(displayName: string): string {
  const name = displayName.trim()
  if (!name)
    return ''
  return `@${name} `
}
