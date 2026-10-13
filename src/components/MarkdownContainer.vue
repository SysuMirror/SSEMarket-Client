<script setup lang="ts">
import mk from '@vscode/markdown-it-katex'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import Prism from 'prismjs'
import { computed, createApp, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMusicList } from '@/api/music/getMusicList'
import { getVideo } from '@/api/video/getVideos'
import { showMsg } from '@/components/MessageBox'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import { addEmojiToPersonalPack, emojiSrc, getCachedEmoji, resolveEmojiIDs } from '@/composables/useEmoji'
import { primeMentionCache, useMentionResolve } from '@/composables/useMentionResolve'
import { musicCoverOrDefault, useMusicStore } from '@/store/musicStore'
import { useUserStore } from '@/store/userStore'
import { injectMentionsInRenderedHTML } from '@/utils/mention'
import 'prismjs/plugins/autoloader/prism-autoloader'
import 'github-markdown-css'
import 'prismjs/themes/prism-tomorrow.css'

const { markdownContent, openLinksInNewTab = false, variant = 'default', extraMentionUsers = [] } = defineProps<{
  markdownContent: string
  /** 聊天等场景：站内链接在新标签打开，避免 SPA 跳转中断进行中的 SSE */
  openLinksInNewTab?: boolean
  /** chat：紧凑排版、去首行缩进、清理空段落（对话气泡） */
  variant?: 'default' | 'chat'
  /** 已知昵称→用户 ID，用于评论作者等，避免等待接口解析 */
  extraMentionUsers?: Array<{ name: string, userID: number }>
}>()

const content = useTemplateRef<HTMLDivElement>('content')
const router = useRouter()
const { playById } = useMusicStore()
const mentionMap = useMentionResolve(computed(() => markdownContent))
const mentionMapVersion = ref(0)
watch(mentionMap, () => {
  mentionMapVersion.value += 1
}, { deep: true })

watch(
  () => extraMentionUsers,
  (users) => {
    for (const u of users ?? []) {
      if (u.name && u.userID > 0)
        primeMentionCache(u.name, u.userID)
    }
    mentionMapVersion.value += 1
  },
  { immediate: true, deep: true },
)

const effectiveMentionMap = computed(() => {
  const map = { ...mentionMap.value }
  for (const u of extraMentionUsers ?? []) {
    if (u.name && u.userID > 0)
      map[u.name] = u.userID
  }
  return map
})

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
  // 帖子内嵌音乐标记：独占一行的 ::music 123:: 渲染为占位卡片，水合后可点播
  text = text.replace(/(^|\n)[ \t]*::music\s+(\d+)::[ \t]*(?=\n|$)/g, (m, lead, id) => `${lead}<div class="post-music" data-music-id="${id}"></div>`)
  // 帖子内嵌视频标记：[video:123] 渲染为受控播放器占位节点
  text = text.replace(/(^|\n)[ \t]*\[video:(\d+)\][ \t]*(?=\n|$)/g, (_m, lead, id) => `${lead}<div class="post-video" data-video-id="${id}"></div>`)
  // 评论/帖子里的表情 token：[emoji:123] → 占位节点，水合后换成 <img>（与聊天气泡同一契约）
  text = text.replace(/\[emoji:(\d+)\]/g, (_m, id) => `<span class="md-emoji" data-emoji-id="${id}">[表情]</span>`)
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
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  mentionMapVersion.value

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
  else
    rendered = injectMentionsInRenderedHTML(rendered, effectiveMentionMap.value)
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
      'div',
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
      'data-user-id',
      'data-music-id',
      'data-video-id',
      'data-emoji-id',
      'role',
      'tabindex',
    ],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onmouseover', 'onmouseout'],
  })
  nextTick(() => {
    Prism.highlightAllUnder(content.value!)
  })

  return finalHTML
})

const emojiPressTimers = new Map<number, ReturnType<typeof setTimeout>>()
let suppressViewerClickUntil = 0

async function handleMarkdownClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // 长按收藏后紧随的 click：拦掉传播，免得图片查看器弹出来
  if (target.classList?.contains('md-emoji__img') && Date.now() < suppressViewerClickUntil) {
    event.stopPropagation()
    return
  }

  const musicCard = target.closest('.post-music[data-music-id]') as HTMLElement | null
  if (musicCard) {
    event.preventDefault()
    event.stopPropagation()
    const id = Number(musicCard.dataset.musicId)
    if (id > 0)
      playById(id)
    return
  }

  const mentionEl = target.closest('[data-user-id].md-mention') as HTMLElement | null
  if (mentionEl) {
    event.preventDefault()
    event.stopPropagation()
    const id = Number(mentionEl.dataset.userId)
    if (id > 0)
      await router.push({ name: 'UserProfile', params: { id: String(id) } })
    return
  }

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

/** 把 ::music id:: 占位 div 填成可播卡片（meta 批量拉一次，删除的显示已失效） */
async function hydrateMusicCards() {
  const root = content.value
  if (!root)
    return
  const cardList = root.querySelectorAll<HTMLElement>('.post-music[data-music-id]:not([data-hydrated])')
  const cards = Array.from(cardList)
  if (cards.length === 0)
    return
  const ids = [...new Set(cards.map(c => Number(c.dataset.musicId)).filter(n => Number.isInteger(n) && n > 0))]
  cards.forEach((c) => {
    c.dataset.hydrated = '1'
  })
  if (ids.length === 0)
    return
  const byId = new Map<number, Awaited<ReturnType<typeof getMusicList>>[number]>()
  try {
    for (const m of await getMusicList({ ids }))
      byId.set(m.musicID, m)
  }
  catch { /* 拉取失败保持占位样式 */ }
  for (const card of cards) {
    const music = byId.get(Number(card.dataset.musicId))
    if (!music) {
      card.classList.add('post-music--gone')
      card.innerHTML = '<span class="post-music__gone-text">音频已失效</span>'
      continue
    }
    const cover = musicCoverOrDefault(music)
    const title = md.utils.escapeHtml(music.title)
    const artist = md.utils.escapeHtml(music.artist || '未知歌手')
    card.innerHTML = `
      <img class="post-music__cover" src="${cover}" alt="" loading="lazy">
      <div class="post-music__meta">
        <div class="post-music__title">${title}</div>
        <div class="post-music__artist">${artist}</div>
      </div>
      <span class="post-music__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
      </span>`
  }
}

async function hydrateVideoCards() {
  const nodes = Array.from(content.value?.querySelectorAll<HTMLElement>('.post-video[data-video-id]:not([data-hydrated])') ?? [])
  if (nodes.length === 0)
    return

  for (const node of nodes) {
    node.dataset.hydrated = '1'
    const id = Number(node.dataset.videoId)
    if (!Number.isInteger(id) || id <= 0)
      continue

    try {
      const video = await getVideo(id)
      createApp(VideoPlayer, { video }).mount(node)
    }
    catch {
      node.textContent = '视频不存在'
    }
  }
}

/** 把 [emoji:123] 占位 span 换成表情图（缓存没有的走 resolve 按需补拉，拉不到保持 [表情] 文本） */
async function hydrateEmojiNodes() {
  const root = content.value
  if (!root)
    return
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.md-emoji[data-emoji-id]:not([data-hydrated])'))
  if (nodes.length === 0)
    return
  nodes.forEach((n) => {
    n.dataset.hydrated = '1'
  })
  const ids = [...new Set(nodes.map(n => Number(n.dataset.emojiId)).filter(n => Number.isInteger(n) && n > 0))]
  await resolveEmojiIDs(ids)
  for (const node of nodes) {
    const emoji = getCachedEmoji(Number(node.dataset.emojiId))
    if (!emoji)
      continue
    const name = md.utils.escapeHtml(emoji.name)
    node.innerHTML = `<img class="md-emoji__img" src="${emojiSrc(emoji)}" alt="${name}" title="${name}（长按 / 右键加入我的表情）" loading="lazy" draggable="false" />`
  }
}

/* ---------------- 评论/帖子里的表情：长按(手机) / 右键(电脑) 加入「我的表情」 ---------------- */

const { isLogin } = useUserStore()

function emojiIDFromTarget(target: EventTarget | null): number | null {
  const el = target as HTMLElement | null
  if (!el?.classList?.contains('md-emoji__img'))
    return null
  const id = Number((el.closest('.md-emoji[data-emoji-id]') as HTMLElement | null)?.dataset.emojiId)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function addStickerToMine(emojiID: number) {
  if (!isLogin.value) {
    showMsg('登录后才能收藏表情', 'error')
    return
  }
  const result = await addEmojiToPersonalPack(emojiID)
  showMsg(result.ok ? '已加入「我的表情」' : result.msg, result.ok ? 'success' : 'error')
}

function onEmojiPointerDown(event: PointerEvent) {
  const id = emojiIDFromTarget(event.target)
  if (id === null)
    return
  const existing = emojiPressTimers.get(id)
  if (existing)
    clearTimeout(existing)
  emojiPressTimers.set(id, setTimeout(() => {
    emojiPressTimers.delete(id)
    // 长按完成后抑制紧随其后的 click（否则图片查看器会弹出来）
    suppressViewerClickUntil = Date.now() + 400
    void addStickerToMine(id)
  }, 550))
}

function cancelEmojiPress(event: PointerEvent) {
  const id = emojiIDFromTarget(event.target)
  if (id === null)
    return
  const timer = emojiPressTimers.get(id)
  if (timer)
    clearTimeout(timer)
  emojiPressTimers.delete(id)
}

function onEmojiContextMenu(event: MouseEvent) {
  const id = emojiIDFromTarget(event.target)
  if (id === null)
    return
  event.preventDefault()
  void addStickerToMine(id)
}

onUnmounted(() => {
  for (const timer of emojiPressTimers.values())
    clearTimeout(timer)
  emojiPressTimers.clear()
})

watch(safeHTML, () => {
  nextTick(() => {
    Prism.highlightAllUnder(content.value!)
    hydrateMusicCards()
    hydrateVideoCards()
    hydrateEmojiNodes()
  })
}, { immediate: true })
</script>

<template>
  <div
    ref="content"
    class="markdown-body w-full"
    :class="{ 'markdown-body--chat': variant === 'chat' }"
    data-theme="light"
    @click="handleMarkdownClick"
    @pointerdown="onEmojiPointerDown"
    @pointerup="cancelEmojiPress"
    @pointerleave="cancelEmojiPress"
    @pointercancel="cancelEmojiPress"
    @contextmenu="onEmojiContextMenu"
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

.markdown-body :deep(.post-music) {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0;
  padding: 8px 12px 8px 8px;
  max-width: 420px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  background: var(--color-card, #f8fafc);
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.markdown-body :deep(.post-music:hover) {
  border-color: #ec4141;
  box-shadow: 0 2px 10px rgba(236, 65, 65, 0.12);
}

.markdown-body :deep(.post-music__cover) {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.markdown-body :deep(.post-music__meta) {
  flex: 1;
  min-width: 0;
}

.markdown-body :deep(.post-music__title) {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #1f2328);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.markdown-body :deep(.post-music__artist) {
  font-size: 12px;
  color: var(--color-text-secondary, #6a737d);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.markdown-body :deep(.post-music__play) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ec4141;
  color: #fff;
  flex-shrink: 0;
}

.markdown-body :deep(.post-music--gone) {
  cursor: default;
}

.markdown-body :deep(.post-music__gone-text) {
  font-size: 13px;
  color: var(--color-text-secondary, #9ca3af);
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

/* 表情 token 水合后的内联小图（尺寸口径与聊天气泡 ChatEmojiText 一致） */
.markdown-body :deep(.md-emoji__img) {
  display: inline-block;
  max-width: 120px;
  max-height: 120px;
  vertical-align: middle;
  border-radius: 6px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.markdown-body :deep(.md-mention) {
  color: #0969da;
  font-weight: inherit;
  background: none;
  padding: 0;
  border-radius: 0;
}

.markdown-body :deep(.md-mention--link) {
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
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
