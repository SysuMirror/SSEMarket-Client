<script setup lang="ts">
import mk from '@vscode/markdown-it-katex'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import Prism from 'prismjs'
import { computed, nextTick, useTemplateRef } from 'vue'
import 'prismjs/plugins/autoloader/prism-autoloader'
import 'github-markdown-css'
import 'prismjs/themes/prism-tomorrow.css'

const { markdownContent, openLinksInNewTab = false, variant = 'default' } = defineProps<{
  markdownContent: string
  /** 聊天等场景：站内链接在新标签打开，避免 SPA 跳转中断进行中的 SSE */
  openLinksInNewTab?: boolean
  /** chat：紧凑排版、去首行缩进、清理空段落（对话气泡） */
  variant?: 'default' | 'chat'
}>()

const content = useTemplateRef<HTMLDivElement>('content')

Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/'

const md: MarkdownIt = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
  xhtmlOut: true,
  langPrefix: 'language-',
}).use(mk, {
  throwOnError: false,
  errorColor: '#cc0000',
  strict: false,
  macros: {},
  // 块级公式的显示模式
  displayMode: true,
  // 行内公式的显示模式
  inlineMode: false,
  // 禁用错误处理
  trust: true,
})

const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  if (env?.openLinksInNewTab) {
    const tIdx = tokens[idx].attrIndex('target')
    if (tIdx < 0)
      tokens[idx].attrPush(['target', '_blank'])
    else
      tokens[idx].attrs![tIdx][1] = '_blank'
    const rIdx = tokens[idx].attrIndex('rel')
    if (rIdx < 0)
      tokens[idx].attrPush(['rel', 'noopener noreferrer'])
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')
  const altIndex = token.attrIndex('alt')
  const titleIndex = token.attrIndex('title')
  if (srcIndex < 0)
    return ''
  if (!token.attrs)
    return ''
  const src = token.attrs[srcIndex][1]
  const alt = altIndex >= 0 ? `alt="${token.content}"` : ''
  const title = titleIndex >= 0 ? ` title="${token.attrs[titleIndex][1]}"` : ''
  // 添加懒加载属性
  return `<img src="${src}"${alt}${title} loading="lazy" />`
}

/**
 * @description 预处理 markdown 内容，使用 encodeURI 编码图片链接中的 URL
 */
/** 聊天场景：去掉模型常见的段首全角空格/空行，避免渲染出空白段落 */
function normalizeChatMarkdown(content: string): string {
  let s = content.replace(/^\uFEFF/, '')
  s = s.replace(/^(?:[ \t\u00A0\u3000]*\r?\n)+/, '')
  s = s.replace(/^\s+/, '')
  s = s.replace(/^[\u3000\u00A0]{1,4}/, '')
  return s.trim()
}

function stripLeadingEmptyBlocks(html: string): string {
  return html.replace(/^(?:\s*<p(?:\s[^>]*)?>\s*(?:<br\s*\/?>\s*)?<\/p>\s*)+/gi, '')
}

function preprocessMarkdown(content: string): string {
  let text = content
  if (variant === 'chat')
    text = normalizeChatMarkdown(text)
  // 先用正则匹配一下
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, urlPart) => {
    const titleIndex = urlPart.lastIndexOf(' "')
    if (titleIndex > 0) {
      return `![${alt}](${encodeURI(urlPart.slice(0, titleIndex))} "${urlPart.slice(titleIndex + 2, -1)}")`
    }
    return `![${alt}](${encodeURI(urlPart)})`
  })
}

/**
 * @description 安全的html，会自动去掉script和iframe之类的标签
 */
const safeHTML = computed(() => {
  if (!markdownContent) {
    return ''
  }

  // 预处理 markdown 内容，编码图片链接中的空格
  const processedContent = preprocessMarkdown(markdownContent)

  // 配置 DOMPurify 以允许 KaTeX 相关标签和属性
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'math' || data.tagName === 'annotation') {
      return node
    }
  })

  let rendered = md.render(processedContent, { openLinksInNewTab })
  if (variant === 'chat')
    rendered = stripLeadingEmptyBlocks(rendered)
  const finalHTML = DOMPurify.sanitize(rendered, {
    ADD_TAGS: [
      'math',
      'mrow',
      'mi',
      'mo',
      'mn',
      'annotation',
      'semantics',
      'mspace',
      'mfrac',
      'msup',
      'msub',
      'span',
    ],
    ADD_ATTR: [
      'xmlns',
      'display',
      'class',
      'width',
      'height',
      'href',
      'target',
      'aria-hidden',
    ],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onmouseover', 'onmouseout'],
  })
  nextTick(() => {
    Prism.highlightAllUnder(content.value!)
  })

  return finalHTML
})
</script>

<template>
  <div
    ref="content"
    class="markdown-body w-full"
    :class="{ 'markdown-body--chat': variant === 'chat' }"
    data-theme="light"
    v-html="safeHTML"
  />
</template>

<style scoped>
:deep(.katex-html) {
  display: none;
}

.markdown-body {
  color: var(--color-text);
  /* 与卡片底色一致：勿再铺一层 page 灰底，避免正文区「加深一块」 */
  background-color: transparent;
}

.markdown-body--chat {
  background-color: transparent;
  font-size: inherit;
  line-height: inherit;
}

.markdown-body--chat :deep(p) {
  margin: 0.35em 0;
  text-indent: 0 !important;
}

.markdown-body--chat :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body--chat :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body--chat :deep(p:empty) {
  display: none;
  margin: 0;
}

/*
 * 表格：github-markdown-light 固定浅色行底，若继承 body 的浅色字（暗色主题）会看不清。
 * 这里强制「深字 + 浅底 + 清晰边框」，在聊天气泡与帖子页均可读。
 */
.markdown-body :deep(table) {
  color: #1f2328;
  border-color: #d1d9e0;
}

.markdown-body :deep(table th),
.markdown-body :deep(table td) {
  padding: 6px 12px;
  color: #1f2328;
  background-color: #ffffff;
  border: 1px solid #c9d1d9;
}

.markdown-body :deep(table th) {
  font-weight: 600;
  background-color: #eff2f5;
}

.markdown-body :deep(table tbody tr:nth-child(even) td) {
  background-color: #f6f8fa;
}

.markdown-body :deep(table tbody tr:nth-child(even) th) {
  background-color: #f6f8fa;
}

:deep(pre) {
  padding: 10px;
  position: relative;
  overflow: auto;
}

:deep(pre code) {
  display: block;
  position: relative;
}

:deep(pre code)::after {
  content: '';
  background-image: url('/PhCopy.webp');
  background-size: cover;
  display: block;
  position: sticky;
  filter: invert(1);
  z-index: 10;
  width: 20px;
  height: 20px;
  bottom: calc(100% - 20px);
  left: calc(100% - 20px);
  margin-top: -20px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  pointer-events: auto;
}

/* :deep(pre) {
  padding: 10px;
  z-index: 0;
  position: relative;
}
:deep(code)::after {
  content: '';
  background-image: url('/PhCopy.webp');
  background-size: cover;
  display: block;
  position: sticky;
  float: right;
  filter: invert(1);
  z-index: 1;
  width: 20px;
  height: 20px;
  top: 5px;
  right: 0;
  transform: translateZ(0);
  background-attachment: local;
  cursor: pointer;
} */
</style>
