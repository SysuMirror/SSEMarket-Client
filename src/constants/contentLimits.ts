/** 帖子正文最大字数（与后端 config.PostContentMaxRunes 一致） */
export const POST_CONTENT_MAX_RUNES = 10000

/** 按 Unicode 码点计数字符数，与 Go utf8.RuneCountInString 行为接近 */
export function countRunes(text: string): number {
  return [...text].length
}

export function isPostContentTooLong(text: string): boolean {
  return countRunes(text) > POST_CONTENT_MAX_RUNES
}
