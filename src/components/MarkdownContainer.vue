<script setup lang="ts">
import mk from '@vscode/markdown-it-katex'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import Prism from 'prismjs'
import { computed, nextTick, useTemplateRef } from 'vue'
import { showMsg } from '@/components/MessageBox'
import { injectMentionHighlightHTML } from '@/utils/mention'
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

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const lang = token.info ? md.utils.escapeHtml(token.info.trim().split(/\s+/g)[0]) : ''
  const langClass = lang ? ` class="language-${lang}"` : ''
  const code = md.utils.escapeHtml(token.content)
  return (
    `<div class="md-code-block">`
    + `<button type="button" class="md-code-block__copy" aria-label="复制代码" title="复制代码">`
    + `<svg class="md-code-block__copy-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="currentColor">`
    + `<path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 14h-7.5A1.75 1.75 0 0 1 0 12.25v-5.5z"/>`
    + `<path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 10h-7.5A1.75 1.75 0 0 1 5 8.25v-7.5zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5z"/>`
    + `</svg><span class="md-code-block__copy-text">复制</span></button>`
    + `<pre><code${langClass}>${code}</code></pre></div>`
  )
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
  if (variant !== 'chat')
    text = injectMentionHighlightHTML(text)
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
      'button',
      'svg',
      'path',
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

async function handleMarkdownClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const copyBtn = target.closest('.md-code-block__copy')
  if (!copyBtn)
    return
  event.preventDefault()
  event.stopPropagation()
  const block = copyBtn.closest('.md-code-block')
  const codeEl = block?.querySelector('code')
  const text = codeEl?.textContent?.trim()
  if (!text) {
    showMsg('没有可复制的内容')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    showMsg('代码已复制')
  }
  catch {
    showMsg('复制失败，请重试')
  }
}
</script>

<template>
  <div
    ref="content"
    class="markdown-body w-full"
    :class="{ 'markdown-body--chat': variant === 'chat' }"
    data-theme="light"
    v-html="safeHTML"
    @click="handleMarkdownClick"
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

.markdown-body :deep(.md-code-block) {
  position: relative;
  margin: 10px 0;
}

.markdown-body :deep(.md-code-block pre) {
  margin: 0;
  padding: 10px 12px 10px;
  padding-top: 36px;
  position: relative;
  overflow: auto;
}

.markdown-body :deep(.md-code-block__copy) {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.55);
    border-color: rgba(255, 255, 255, 0.35);
    color: #fff;
  }
}

.markdown-body :deep(.md-code-block__copy-icon) {
  flex-shrink: 0;
}

.markdown-body :deep(.md-code-block pre code) {
  display: block;
}
</style>
