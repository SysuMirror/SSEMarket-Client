/**
 * markdown-it-emoji@3 自带的类型声明（上游未发布 .d.ts）。
 * 注意：三个预设的 options 都是「整体替换」语义——
 * 传 shortcuts: {} 即可完全关闭 :) 等颜文字快捷转换。
 */
declare module 'markdown-it-emoji' {
  import type { PluginWithOptions } from 'markdown-it'

  export interface MarkdownItEmojiOptions {
    /** shortcode → emoji 字符映射表；提供时整体替换预设 */
    defs?: Record<string, string>
    /** 白名单：为空数组表示全部启用 */
    enabled?: string[]
    /** 颜文字快捷键（如 ':)' → 'smile'）；提供时整体替换预设，传 {} 即全关 */
    shortcuts?: Record<string, string | string[]>
  }

  export const full: PluginWithOptions<MarkdownItEmojiOptions>
  export const light: PluginWithOptions<MarkdownItEmojiOptions>
  export const bare: PluginWithOptions<MarkdownItEmojiOptions>
}
