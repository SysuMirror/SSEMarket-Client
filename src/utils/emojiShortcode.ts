/**
 * 表情 shortcode 提取工具。
 *
 * 设计约定：评论/帖子正文中表情一律存 `:shortcode:` 形态（与 GitHub 一致），
 * 由 MarkdownContainer 的 markdown-it-emoji 插件在渲染期替换为 Unicode 字符。
 * 好处：库内容保持纯 ASCII（不依赖 DB 表字符集）、旧客户端优雅降级为文字、
 * 后续集市主题表情包可复用同一条管线（shortcode → 图片的白名单映射）。
 */

/**
 * 从 emoji-mart 的 emoji.shortcodes（如 ":smile:"、":+1::skin-tone-3:"）中
 * 提取首个基础 shortcode，剥离肤色变体（:skin-tone-N:）。
 * 取不到时回退到 ":<id>:"；仍取不到返回空串（调用方放弃插入）。
 */
export function extractBaseShortcode(shortcodes?: string, fallbackId?: string): string {
  const first = shortcodes?.match(/:[^:]+:/)?.[0]
  if (first && !/^:skin-tone-\d+:$/.test(first))
    return first
  return fallbackId ? `:${fallbackId}:` : ''
}
