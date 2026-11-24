/**
 * 表情 shortcode 提取工具。
 *
 * 当前策略：编辑器选中的标准 emoji 直接插入 Unicode 字符（所见即所得，
 * 评论表 utf8mb4 已确认）。本工具作为两类场景的回退：
 * 1. 手写 `:smile:` —— MarkdownContainer 的 markdown-it-emoji 插件渲染；
 * 2. 二期集市自定义表情包 —— 无 native 字段，插入 shortcode 走白名单映射。
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
