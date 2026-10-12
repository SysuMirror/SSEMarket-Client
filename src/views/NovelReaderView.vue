<script lang="ts" setup>
import type { NovelChapterDetail, NovelChapterItem, NovelCommentItem, NovelParagraphItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createNovelComment,
  getNovelChapter,
  getNovelChapters,
  getNovelComments,
  reportNovelProgress,
  toggleShelf,
} from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import NovelCommentCard from '@/components/novel/NovelCommentCard.vue'
import { useUserStore } from '@/store/userStore'
import { novelBookPath } from '@/utils/novelRoute'
import { formatNovelTime, formatWordCount, novelParagraphExcerpt, novelParagraphImage } from '@/utils/novelText'
import { setTitle } from '@/utils/title'
import { setWindowScrollY } from '@/utils/windowScroll'

defineOptions({ name: 'NovelReaderView' })

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const SETTINGS_KEY = 'novel-reader-settings'
const FONT_SIZES = [15, 17, 19, 21, 23]
const PROGRESS_REPORT_MS = 12000
/** 阅读心跳间隔：每 15 秒上报一次本次实际阅读秒数，后端满 1 小时结算经验。 */
const READ_HEARTBEAT_MS = 15000
/** 与后端 domain.NovelReadHeartbeatMaxSeconds 一致：单次心跳最多计入的秒数。 */
const READ_HEARTBEAT_MAX_SECONDS = 120

/** 阅读主题：默认 / 护眼 / 夜间 */
type ReaderTheme = 'light' | 'sepia' | 'dark'
const READER_THEMES: { key: ReaderTheme, label: string }[] = [
  { key: 'light', label: '默认' },
  { key: 'sepia', label: '护眼' },
  { key: 'dark', label: '夜间' },
]

interface ReaderSettings {
  fontIndex: number
  wideLine: boolean
  theme: ReaderTheme
}

function normalizeTheme(v: unknown): ReaderTheme {
  return v === 'sepia' || v === 'dark' ? v : 'light'
}

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw)
      return { fontIndex: 1, wideLine: false, theme: 'light' }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    const fontIndex = Number(parsed.fontIndex)
    return {
      fontIndex: Number.isFinite(fontIndex) && fontIndex >= 0 && fontIndex < FONT_SIZES.length ? fontIndex : 1,
      wideLine: Boolean(parsed.wideLine),
      theme: normalizeTheme(parsed.theme),
    }
  }
  catch {
    return { fontIndex: 1, wideLine: false, theme: 'light' }
  }
}

const settings = ref<ReaderSettings>(loadSettings())
const detail = ref<NovelChapterDetail | null>(null)
const loading = ref(true)
const shelfBusy = ref(false)

/** 段评面板状态 */
const activeParagraph = ref<NovelParagraphItem | null>(null)
const panelComments = ref<NovelCommentItem[]>([])
const panelLoading = ref(false)
const draft = ref('')
const draftBusy = ref(false)

/** 选中正文后浮现的操作菜单（复制 / 发段评） */
const selMenu = ref<{ paragraph: NovelParagraphItem | null, text: string, x: number, y: number } | null>(null)
const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP = 12
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressStart: { x: number, y: number } | null = null

/** 正文配图：点开放大查看 */
const lightboxURL = ref('')

/** 阅读进度 */
const furthestIndex = ref(0)
let observer: IntersectionObserver | null = null
let progressTimer: ReturnType<typeof setTimeout> | null = null
let lastReportedPercent = -1
/** 阅读时长心跳：累计「还没上报的秒数」，后端按满 1 小时结算经验 */
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lastTickAt = 0
let pendingReadSeconds = 0
let reportingProgress = false

const chapterID = computed(() => Number(route.params.chapterID) || 0)

/**
 * 段落列表。后端已带 imageURL 就直接用；没带（旧数据 / 旧服务）时按正文自己判定，
 * 口径与后端 domain.NovelParagraphImage 一致，保证图片段落仍能正确渲染成单独一段。
 */
const paragraphs = computed<NovelParagraphItem[]>(() =>
  (detail.value?.paragraphs ?? []).map(p => ({
    ...p,
    imageURL: p.imageURL || novelParagraphImage(p.text),
  })),
)
const fontPx = computed(() => FONT_SIZES[settings.value.fontIndex])

const progressPercent = computed(() => {
  const total = paragraphs.value.length
  if (total === 0)
    return 0
  return Math.min(100, Math.round((furthestIndex.value / total) * 100))
})

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
  }
  catch {
    // 隐私模式下 localStorage 可能不可用，忽略
  }
}

/** 主题类名：根节点和 Teleport 出去的面板都挂上，CSS 变量随主题走 */
const themeClass = computed(() => `novel-reader--${settings.value.theme}`)

function setTheme(theme: ReaderTheme) {
  settings.value.theme = theme
  saveSettings()
}

function shiftFontSize(delta: 1 | -1) {
  const next = settings.value.fontIndex + delta
  if (next < 0 || next >= FONT_SIZES.length)
    return
  settings.value.fontIndex = next
  saveSettings()
}

function setWideLine(wide: boolean) {
  settings.value.wideLine = wide
  saveSettings()
}

// ---------------------------------------------------------------------------
// 阅读设置面板 / 目录抽屉
// ---------------------------------------------------------------------------

const settingsOpen = ref(false)
const tocOpen = ref(false)
const tocChapters = ref<NovelChapterItem[]>([])
const tocTotal = ref(0)
const tocBusy = ref(false)
const tocLoaded = ref(false)
const TOC_PAGE_SIZE = 50

async function loadTocPage() {
  if (!detail.value || tocBusy.value)
    return
  if (tocLoaded.value && tocChapters.value.length >= tocTotal.value)
    return
  tocBusy.value = true
  try {
    const result = await getNovelChapters(detail.value.novelID, TOC_PAGE_SIZE, tocChapters.value.length)
    const seen = new Set(tocChapters.value.map(c => c.chapterID))
    for (const c of result.chapters) {
      if (!seen.has(c.chapterID))
        tocChapters.value.push(c)
    }
    tocTotal.value = result.total
    tocLoaded.value = true
  }
  finally {
    tocBusy.value = false
  }
}

async function openToc() {
  tocOpen.value = true
  settingsOpen.value = false
  await loadTocPage()
}

function openSettings() {
  settingsOpen.value = !settingsOpen.value
  tocOpen.value = false
}

async function jumpToChapter(target: number) {
  tocOpen.value = false
  await goToChapter(target)
}

function scheduleProgress() {
  if (progressTimer)
    return
  progressTimer = setTimeout(() => {
    progressTimer = null
    void flushProgress()
  }, PROGRESS_REPORT_MS)
}

/** 累计「还没上报的阅读秒数」：页面在后台就不计，单次最多计 120 秒。 */
function accumulateReadSeconds() {
  const now = Date.now()
  const elapsed = Math.round((now - lastTickAt) / 1000)
  lastTickAt = now
  if (elapsed <= 0 || document.hidden)
    return
  pendingReadSeconds += Math.min(elapsed, READ_HEARTBEAT_MAX_SECONDS)
}

function startReadHeartbeat() {
  lastTickAt = Date.now()
  if (heartbeatTimer)
    clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    accumulateReadSeconds()
    void flushProgress()
  }, READ_HEARTBEAT_MS)
}

/** 停心跳前先把最后一段零头结算进 pendingReadSeconds。 */
function stopReadHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  accumulateReadSeconds()
}

async function flushProgress() {
  if (!detail.value || reportingProgress)
    return
  const readSeconds = pendingReadSeconds
  const percent = progressPercent.value
  const percentChanged = furthestIndex.value > 0 && percent !== lastReportedPercent
  if (readSeconds <= 0 && !percentChanged)
    return
  reportingProgress = true
  const ok = await reportNovelProgress({
    novelID: detail.value.novelID,
    chapterID: detail.value.chapter.chapterID,
    paragraphIndex: furthestIndex.value,
    percent,
    readSeconds,
  })
  reportingProgress = false
  // 上报成功才清零；失败就留到下次心跳一起补报
  if (!ok)
    return
  pendingReadSeconds = 0
  if (percentChanged)
    lastReportedPercent = percent
}

async function observeParagraphs() {
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => {
    let touched = false
    for (const entry of entries) {
      if (!entry.isIntersecting)
        continue
      const el = entry.target as HTMLElement
      const index = Number(el.dataset.index)
      if (!Number.isFinite(index))
        continue
      touched = true
      if (index > furthestIndex.value)
        furthestIndex.value = index
    }
    if (touched)
      scheduleProgress()
  }, { threshold: 0.4 })

  await nextTick()
  document.querySelectorAll<HTMLElement>('.novel-reader__para[data-index]')
    .forEach(el => observer?.observe(el))
}

async function loadChapter() {
  // 换章前先把上一章累计的阅读秒数结算掉，别记到新章头上
  if (detail.value) {
    accumulateReadSeconds()
    await flushProgress()
  }
  pendingReadSeconds = 0
  loading.value = true
  activeParagraph.value = null
  lightboxURL.value = ''
  furthestIndex.value = 0
  lastReportedPercent = -1

  const data = await getNovelChapter(chapterID.value)
  if (!data) {
    loading.value = false
    showMsg('章节不存在或已被删除')
    router.replace('/novel')
    return
  }
  detail.value = data
  furthestIndex.value = 0
  setTitle(`${data.novelTitle} · ${data.chapter.title}`)
  loading.value = false
  setWindowScrollY(0)
  await observeParagraphs()
}

async function openParagraph(p: NovelParagraphItem) {
  hideSelMenu()
  activeParagraph.value = p
  panelLoading.value = true
  panelComments.value = []
  if (!detail.value) {
    panelLoading.value = false
    return
  }
  const result = await getNovelComments({
    novelID: detail.value.novelID,
    targetType: 'paragraph',
    chapterID: detail.value.chapter.chapterID,
    paragraphIndex: p.index,
    limit: 50,
  })
  panelComments.value = result.comments
  panelLoading.value = false
}

function closePanel() {
  activeParagraph.value = null
  draft.value = ''
  hideSelMenu()
  clearSelection()
}

// ---------------------------------------------------------------------------
// 选中正文 → 复制 / 发段评（桌面拖选，移动端长按整段）
// ---------------------------------------------------------------------------

const SEL_MENU_W = 216

/** 桌面端贴着选区浮出；移动端固定在底部导航上方，不跟选区跑。 */
const selMenuStyle = computed<Record<string, string>>(() => {
  const menu = selMenu.value
  const style: Record<string, string> = {}
  if (!menu || window.innerWidth < 769)
    return style
  style.left = `${menu.x}px`
  style.top = `${menu.y}px`
  return style
})

function clearSelection() {
  window.getSelection()?.removeAllRanges()
}

function hideSelMenu() {
  selMenu.value = null
}

/** 节点所在的段落元素；跨段选中按起点这一段算。 */
function paragraphElFromNode(node: Node | null): HTMLElement | null {
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement | null
  return el?.closest<HTMLElement>('.novel-reader__para[data-index]') ?? null
}

function captureSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    hideSelMenu()
    return
  }
  const range = sel.getRangeAt(0)
  const text = sel.toString().trim()
  const el = paragraphElFromNode(range.startContainer)
  const index = Number(el?.dataset.index)
  const paragraph = Number.isFinite(index)
    ? paragraphs.value.find(p => p.index === index) ?? null
    : null
  if (!text || !paragraph) {
    hideSelMenu()
    return
  }
  const rect = range.getBoundingClientRect()
  const vw = window.innerWidth
  selMenu.value = {
    paragraph,
    text,
    x: Math.min(Math.max(8, rect.left), Math.max(8, vw - SEL_MENU_W - 8)),
    y: Math.max(8, rect.top - 46),
  }
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  }
  catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

async function copySelection() {
  const text = selMenu.value?.text ?? ''
  if (!text)
    return
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  }
  catch {
    // 非安全上下文 / 旧浏览器退回 execCommand
    ok = legacyCopy(text)
  }
  hideSelMenu()
  clearSelection()
  showMsg(ok ? '已复制选中文字' : '复制失败，请手动复制')
}

function commentSelection() {
  const paragraph = selMenu.value?.paragraph
  hideSelMenu()
  clearSelection()
  if (paragraph)
    void openParagraph(paragraph)
}

function selectParagraph(el: HTMLElement) {
  const span = el.querySelector<HTMLElement>('.novel-reader__para-text')
  if (!span)
    return
  const range = document.createRange()
  range.selectNodeContents(span)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  captureSelection()
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  longPressStart = null
}

function onBodyTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch)
    return
  longPressStart = { x: touch.clientX, y: touch.clientY }
  const el = (e.target as HTMLElement).closest?.<HTMLElement>('.novel-reader__para[data-index]')
  if (!el)
    return
  cancelLongPress()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    selectParagraph(el)
  }, LONG_PRESS_MS)
}

function onBodyTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch || !longPressStart)
    return
  if (Math.abs(touch.clientX - longPressStart.x) > LONG_PRESS_SLOP
    || Math.abs(touch.clientY - longPressStart.y) > LONG_PRESS_SLOP) {
    cancelLongPress()
  }
}

function onDocumentPointerDown(e: PointerEvent) {
  if (!selMenu.value)
    return
  if ((e.target as HTMLElement).closest?.('.novel-reader__selmenu'))
    return
  hideSelMenu()
}

function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape')
    return
  if (selMenu.value) {
    hideSelMenu()
    clearSelection()
    return
  }
  if (lightboxURL.value) {
    lightboxURL.value = ''
    return
  }
  if (settingsOpen.value) {
    settingsOpen.value = false
    return
  }
  if (tocOpen.value) {
    tocOpen.value = false
    return
  }
  if (activeParagraph.value)
    closePanel()
}

/** 段评删除：从面板列表里移除这一条，再减计数 */
function onPanelCommentDeleted(commentID: number) {
  panelComments.value = panelComments.value.filter(c => c.commentID !== commentID)
  if (activeParagraph.value)
    activeParagraph.value.commentNum = Math.max(activeParagraph.value.commentNum - 1, 0)
  if (detail.value)
    detail.value.chapter.commentNum = Math.max(detail.value.chapter.commentNum - 1, 0)
}

function openLightbox(url: string) {
  if (!url)
    return
  lightboxURL.value = url
}

/** 页面切到后台：先结算已读秒数；切回前台不把后台停留时间算成阅读。 */
function onVisibilityChange() {
  if (document.hidden) {
    accumulateReadSeconds()
    void flushProgress()
    return
  }
  lastTickAt = Date.now()
}

/** 菜单按选区坐标定位，滚动后坐标失效，所以一滚就收。 */
function onScrollDismiss() {
  if (selMenu.value)
    hideSelMenu()
}

async function submitParagraphComment() {
  if (!detail.value || !activeParagraph.value || draftBusy.value)
    return
  const content = draft.value.trim()
  if (!content) {
    showMsg('先写点内容')
    return
  }
  const paragraph = activeParagraph.value
  draftBusy.value = true
  const result = await createNovelComment({
    novelID: detail.value.novelID,
    targetType: 'paragraph',
    chapterID: detail.value.chapter.chapterID,
    paragraphIndex: paragraph.index,
    content,
  })
  draftBusy.value = false
  if (!result.comment) {
    showMsg(result.msg || '发布失败，请稍后重试')
    return
  }
  draft.value = ''
  panelComments.value.unshift(result.comment)
  paragraph.commentNum += 1
  detail.value.chapter.commentNum += 1
}

function onLiked(c: NovelCommentItem) {
  c.isLiked = !c.isLiked
  c.likeNum += c.isLiked ? 1 : -1
}

async function onToggleShelf() {
  if (!detail.value || shelfBusy.value)
    return
  shelfBusy.value = true
  const result = await toggleShelf(detail.value.novelID)
  shelfBusy.value = false
  if (!result) {
    showMsg('操作失败，请稍后重试')
    return
  }
  detail.value.onShelf = result.onShelf
  showMsg(result.msg)
}

async function goToChapter(target: number) {
  if (!target)
    return
  await flushProgress()
  await router.push(`/novel/read/${target}`)
}

watch(chapterID, () => {
  void loadChapter()
})

onMounted(() => {
  void loadChapter()
  startReadHeartbeat()
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('scroll', onScrollDismiss, { passive: true })
  window.addEventListener('resize', onScrollDismiss)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('scroll', onScrollDismiss)
  window.removeEventListener('resize', onScrollDismiss)
  cancelLongPress()
  if (progressTimer)
    clearTimeout(progressTimer)
  stopReadHeartbeat()
  observer?.disconnect()
  void flushProgress()
})
</script>

<template>
  <div v-if="detail" class="novel-zone novel-reader" :class="[themeClass, { 'novel-reader--panel-open': activeParagraph !== null }]">
    <header class="novel-reader__bar">
      <RouterLink class="novel-reader__bar-btn" :to="novelBookPath(detail.novelID)">
        <Icon icon="tabler:chevron-left" width="18" height="18" aria-hidden="true" />
      </RouterLink>
      <div class="novel-reader__bar-title">
        <span class="novel-reader__bar-book">{{ detail.novelTitle }}</span>
        <span class="novel-reader__bar-chapter">{{ detail.chapter.chapterNum }}. {{ detail.chapter.title }}</span>
      </div>
      <div class="novel-reader__bar-actions">
        <button type="button" class="novel-reader__bar-btn" title="目录" @click="openToc">
          <Icon icon="tabler:list" width="18" height="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="novel-reader__bar-btn"
          :class="{ 'novel-reader__bar-btn--on': settingsOpen }"
          title="阅读设置"
          @click="openSettings"
        >
          <Icon icon="tabler:settings" width="18" height="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="novel-reader__bar-btn"
          :class="{ 'novel-reader__bar-btn--on': detail.onShelf }"
          :disabled="shelfBusy"
          :title="detail.onShelf ? '已在书架' : '加入书架'"
          @click="onToggleShelf"
        >
          <Icon :icon="detail.onShelf ? 'tabler:bookmark-filled' : 'tabler:bookmark'" width="18" height="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <article
      class="novel-reader__body"
      :class="{ 'novel-reader__body--wide': settings.wideLine }"
      :style="{ fontSize: `${fontPx}px` }"
      @mouseup="captureSelection"
      @touchstart.passive="onBodyTouchStart"
      @touchmove.passive="onBodyTouchMove"
      @touchend="cancelLongPress"
      @touchcancel="cancelLongPress"
    >
      <h1 class="novel-reader__chapter-title">
        {{ detail.chapter.chapterNum }}. {{ detail.chapter.title }}
      </h1>
      <p class="novel-reader__chapter-meta">
        <span>{{ formatWordCount(detail.chapter.wordNum) }}</span>
        <span class="novel-reader__dot">·</span>
        <span>{{ formatNovelTime(detail.chapter.createdAt) }}</span>
        <span class="novel-reader__dot">·</span>
        <span>{{ detail.chapter.commentNum }}条段评</span>
      </p>

      <p
        v-for="p in paragraphs"
        :key="p.index"
        class="novel-reader__para"
        :class="{ 'novel-reader__para--image': p.imageURL !== '' }"
        :data-index="p.index"
      >
        <!-- 图片段落：单独一段居中，点开看大图 -->
        <img
          v-if="p.imageURL"
          class="novel-reader__para-img"
          :src="p.imageURL"
          :alt="`第 ${p.index + 1} 段配图`"
          loading="lazy"
          decoding="async"
          @click.stop="openLightbox(p.imageURL)"
        >
        <span v-else class="novel-reader__para-text">{{ p.text }}</span>
        <button
          v-if="p.commentNum > 0"
          type="button"
          class="novel-reader__bubble"
          :title="`${p.commentNum} 条段评`"
          @click.stop="openParagraph(p)"
        >
          <Icon icon="tabler:message-circle" width="13" height="13" aria-hidden="true" />
          <span>{{ p.commentNum }}</span>
        </button>
      </p>

      <section v-if="detail.authorNote" class="novel-reader__note">
        <h2 class="novel-reader__note-title">
          <Icon icon="tabler:pencil" width="14" height="14" aria-hidden="true" />
          作者有话说
        </h2>
        <p class="novel-reader__note-text">
          {{ detail.authorNote }}
        </p>
      </section>

      <nav class="novel-reader__nav">
        <button
          type="button"
          class="novel-reader__nav-btn"
          :disabled="!detail.prev"
          @click="goToChapter(detail.prev?.chapterID ?? 0)"
        >
          <Icon icon="tabler:chevron-left" width="15" height="15" aria-hidden="true" />
          <span>{{ detail.prev ? detail.prev.title : '没有上一章' }}</span>
        </button>
        <button
          type="button"
          class="novel-reader__nav-btn novel-reader__nav-btn--next"
          :disabled="!detail.next"
          @click="goToChapter(detail.next?.chapterID ?? 0)"
        >
          <span>{{ detail.next ? detail.next.title : '已读到最新' }}</span>
          <Icon icon="tabler:chevron-right" width="15" height="15" aria-hidden="true" />
        </button>
      </nav>

      <p class="novel-reader__progress">
        本章进度 {{ progressPercent }}%
      </p>
    </article>

    <!-- Teleport 到 body：.app-main 自带 z-index:1 会把面板的层级关在低层上下文里，
         导致面板头部被站点头（z-index 2100）盖住。 -->
    <Teleport to="body">
      <div v-if="activeParagraph" class="novel-reader__mask" @click="closePanel" />
      <Transition name="novel-panel">
        <section v-if="activeParagraph" class="novel-reader__panel" :class="themeClass" aria-label="段落评论">
          <span class="novel-reader__panel-grip" aria-hidden="true" />

          <header class="novel-reader__panel-head">
            <div class="novel-reader__panel-para">
              <span class="novel-reader__panel-num">
                第 {{ activeParagraph.index + 1 }} 段 · {{ panelComments.length }} 条
              </span>
              <p class="novel-reader__panel-excerpt">
                {{ novelParagraphExcerpt(activeParagraph.text, 60) }}
              </p>
            </div>
            <button type="button" class="novel-reader__panel-close" aria-label="关闭评论" @click="closePanel">
              <Icon icon="tabler:x" width="16" height="16" aria-hidden="true" />
              <span>关闭</span>
            </button>
          </header>

          <div class="novel-reader__panel-list">
            <p v-if="panelLoading" class="novel-reader__panel-empty">
              加载中…
            </p>
            <ul v-else-if="panelComments.length > 0" class="novel-reader__panel-ul">
              <NovelCommentCard
                v-for="c in panelComments"
                :key="c.commentID"
                :comment="c"
                :show-excerpt="false"
                :deletable="c.authorID === userInfo.userID"
                @like-change="onLiked(c)"
                @deleted="onPanelCommentDeleted"
              />
            </ul>
            <p v-else class="novel-reader__panel-empty">
              这一段还没有评论
            </p>
          </div>

          <div class="novel-reader__panel-form">
            <textarea
              v-model="draft"
              class="novel-reader__panel-input"
              rows="2"
              maxlength="500"
              placeholder="对这一段说点什么（最多 500 字）"
            />
            <button
              type="button"
              class="novel-reader__panel-submit"
              :disabled="draftBusy"
              @click="submitParagraphComment"
            >
              {{ draftBusy ? '发送中…' : '发布' }}
            </button>
          </div>
        </section>
      </Transition>

      <Transition name="novel-selmenu">
        <div v-if="selMenu" class="novel-reader__selmenu" :style="selMenuStyle" role="menu" aria-label="选中文字操作">
          <button type="button" role="menuitem" @click="copySelection">
            <Icon icon="tabler:copy" width="14" height="14" aria-hidden="true" />
            <span>复制</span>
          </button>
          <span class="novel-reader__selmenu-sep" aria-hidden="true" />
          <button type="button" role="menuitem" @click="commentSelection">
            <Icon icon="tabler:message-circle" width="14" height="14" aria-hidden="true" />
            <span>发段评</span>
          </button>
        </div>
      </Transition>

      <Transition name="novel-lightbox">
        <div v-if="lightboxURL" class="novel-reader__lightbox" @click="lightboxURL = ''">
          <img class="novel-reader__lightbox-img" :src="lightboxURL" alt="正文配图">
          <span class="novel-reader__lightbox-tip">点击任意处关闭 · Esc</span>
        </div>
      </Transition>

      <!-- 阅读设置：移动端底部面板 / 桌面居中小卡（主题 / 字号 / 行距） -->
      <div v-if="settingsOpen" class="novel-reader__sheet-mask" @click="settingsOpen = false" />
      <Transition name="novel-sheet">
        <section v-if="settingsOpen" class="novel-reader__sheet" :class="themeClass" aria-label="阅读设置">
          <span class="novel-reader__sheet-grip" aria-hidden="true" />
          <div class="novel-reader__sheet-row">
            <span class="novel-reader__sheet-label">主题</span>
            <div class="novel-reader__sheet-themes">
              <button
                v-for="t in READER_THEMES"
                :key="t.key"
                type="button"
                class="novel-reader__theme-dot"
                :class="[`novel-reader__theme-dot--${t.key}`, { 'novel-reader__theme-dot--on': settings.theme === t.key }]"
                :aria-pressed="settings.theme === t.key"
                @click="setTheme(t.key)"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
          <div class="novel-reader__sheet-row">
            <span class="novel-reader__sheet-label">字号</span>
            <div class="novel-reader__sheet-controls">
              <button
                type="button"
                class="novel-reader__sheet-btn"
                :disabled="settings.fontIndex <= 0"
                aria-label="减小字号"
                @click="shiftFontSize(-1)"
              >
                A-
              </button>
              <span class="novel-reader__sheet-value">{{ fontPx }}px</span>
              <button
                type="button"
                class="novel-reader__sheet-btn"
                :disabled="settings.fontIndex >= FONT_SIZES.length - 1"
                aria-label="增大字号"
                @click="shiftFontSize(1)"
              >
                A+
              </button>
            </div>
          </div>
          <div class="novel-reader__sheet-row">
            <span class="novel-reader__sheet-label">行距</span>
            <div class="novel-reader__sheet-controls">
              <button
                type="button"
                class="novel-reader__sheet-btn novel-reader__sheet-btn--opt"
                :class="{ 'novel-reader__sheet-btn--on': !settings.wideLine }"
                @click="setWideLine(false)"
              >
                标准
              </button>
              <button
                type="button"
                class="novel-reader__sheet-btn novel-reader__sheet-btn--opt"
                :class="{ 'novel-reader__sheet-btn--on': settings.wideLine }"
                @click="setWideLine(true)"
              >
                宽松
              </button>
            </div>
          </div>
        </section>
      </Transition>

      <!-- 目录抽屉：章节分页加载，当前章高亮 -->
      <div v-if="tocOpen" class="novel-reader__sheet-mask" @click="tocOpen = false" />
      <Transition name="novel-toc">
        <section v-if="tocOpen" class="novel-reader__toc" :class="themeClass" aria-label="目录">
          <header class="novel-reader__toc-head">
            <span class="novel-reader__toc-title">目录 {{ tocTotal ? `(${tocTotal}章)` : '' }}</span>
            <button type="button" class="novel-reader__toc-close" aria-label="关闭目录" @click="tocOpen = false">
              <Icon icon="tabler:x" width="16" height="16" aria-hidden="true" />
            </button>
          </header>
          <ul class="novel-reader__toc-list">
            <li v-for="c in tocChapters" :key="c.chapterID">
              <button
                type="button"
                class="novel-reader__toc-item"
                :class="{ 'novel-reader__toc-item--current': c.chapterID === chapterID }"
                @click="jumpToChapter(c.chapterID)"
              >
                <span class="novel-reader__toc-num">{{ c.chapterNum }}</span>
                <span class="novel-reader__toc-name">{{ c.title }}</span>
              </button>
            </li>
          </ul>
          <p v-if="tocLoaded && tocChapters.length === 0" class="novel-reader__toc-empty">
            还没有章节
          </p>
          <button
            v-if="tocChapters.length > 0 && tocChapters.length < tocTotal"
            type="button"
            class="novel-reader__toc-more"
            :disabled="tocBusy"
            @click="loadTocPage"
          >
            {{ tocBusy ? '加载中…' : `加载更多（还有 ${tocTotal - tocChapters.length} 章）` }}
          </button>
        </section>
      </Transition>
    </Teleport>
  </div>

  <div v-else class="novel-reader__loading">
    {{ loading ? '加载中…' : '章节不存在' }}
  </div>
</template>

<style scoped lang="scss">
.novel-reader {
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto;
  padding: 0 10px 24px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.novel-reader__bar {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  background: var(--color-card, #fff);
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.novel-reader__bar-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.novel-reader__bar-book {
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-reader__bar-chapter {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-reader__bar-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.novel-reader__bar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
  text-decoration: none;

  &:active {
    background: var(--color-hover, rgba(44, 61, 86, 0.06));
  }

  &--on {
    color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.novel-reader__body {
  padding: 14px 2px 4px;
  line-height: 1.8;
  color: var(--color-text, #1e293b);

  &--wide {
    line-height: 2.3;
  }
}

.novel-reader__chapter-title {
  margin: 0 0 6px;
  font-size: 1.25em;
  font-weight: 700;
}

.novel-reader__chapter-meta {
  margin: 0 0 18px;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-reader__dot {
  margin: 0 4px;
  opacity: 0.6;
}

/* 正文只负责选中：拖选 / 长按出「复制 · 发段评」菜单，段落本身不再是按钮。 */
.novel-reader__para {
  margin: 0 0 14px;
  text-indent: 2em;
  word-break: break-word;

  ::selection {
    background: var(--accent-soft, rgba(44, 61, 86, 0.18));
    color: inherit;
  }
}

.novel-reader__para-text {
  display: inline;
}

/* 图片段落：整段就是一张图，不缩进、居中、上下留白（正文里就是「上下各一个空行」）。 */
.novel-reader__para--image {
  margin: 18px 0 20px;
  text-indent: 0;
  text-align: center;
}

.novel-reader__para-img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border-radius: 10px;
  background: var(--color-bg, #f5f6f7);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.14);
  cursor: zoom-in;
}

/* 图片段落的段评气泡换到图片下方一行，别压在图上 */
.novel-reader__para--image .novel-reader__bubble {
  margin-top: 8px;
  margin-left: 0;
}

/* 只有已有段评的段落才挂气泡，空段评不占位、不干扰阅读。 */
.novel-reader__bubble {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
  padding: 1px 8px;
  border: none;
  border-radius: 999px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.1));
  font-size: 11px;
  font-weight: 700;
  color: var(--accent, #2c3d56);
  cursor: pointer;
  vertical-align: 0.15em;

  &:hover {
    background: var(--accent, #2c3d56);
    color: #fff;
  }
}

.novel-reader__note {
  margin: 22px 0 8px;
  padding: 12px 14px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  border-left: 3px solid var(--accent, #2c3d56);
  border-radius: 6px;
}

.novel-reader__note-title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent, #2c3d56);
}

.novel-reader__note-text {
  margin: 0;
  font-size: 0.85em;
  line-height: 1.7;
  color: var(--color-text-secondary, #475569);
  white-space: pre-wrap;
  word-break: break-word;
}

.novel-reader__nav {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.novel-reader__nav-btn {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 9px;
  background: var(--color-card, #fff);
  color: var(--color-text, #1e293b);
  font-size: 12px;
  cursor: pointer;

  span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--next span {
    text-align: right;
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.novel-reader__progress {
  margin: 10px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

/* 遮罩从站点头下方开始，点头保持可点，不会被误当成“关闭”。 */
.novel-reader__mask {
  position: fixed;
  top: var(--layout-header-h, 2.75rem);
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2200;
  background: rgba(15, 23, 42, 0.4);
}

/* 移动端：底部抽屉，留出正文可见区域；输入框固定在底部。 */
.novel-reader__panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2201;
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  padding: 6px 12px calc(var(--layout-bottom-nav-h, 52px) + 10px);
  box-sizing: border-box;
  background: var(--color-card, #fff);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.16);
}

.novel-reader__panel-grip {
  flex-shrink: 0;
  width: 38px;
  height: 4px;
  margin: 2px auto 8px;
  border-radius: 999px;
  background: var(--color-border, rgba(71, 85, 105, 0.22));
}

.novel-reader__panel-head {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.novel-reader__panel-para {
  flex: 1;
  min-width: 0;
}

.novel-reader__panel-num {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent, #2c3d56);
  margin-bottom: 2px;
}

.novel-reader__panel-excerpt {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary, #475569);
}

.novel-reader__panel-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.18));
  border-radius: 8px;
  background: var(--color-bg, #f5f6f7);
  font-size: 12px;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;

  &:hover {
    background: var(--color-hover, rgba(44, 61, 86, 0.08));
    color: var(--color-text, #1e293b);
  }
}

/* 输入框钉在面板底部，评论列表在它上方滚动。 */
.novel-reader__panel-form {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
}

.novel-reader__panel-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  background: var(--color-bg, #f5f6f7);
  color: var(--color-text, #1e293b);

  &:focus {
    outline: none;
    border-color: var(--accent, #2c3d56);
  }
}

.novel-reader__panel-submit {
  flex-shrink: 0;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-reader__panel-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.novel-reader__panel-ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.novel-reader__panel-empty {
  padding: 16px;
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-reader__loading {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-panel-enter-active,
.novel-panel-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.novel-panel-enter-from,
.novel-panel-leave-to {
  transform: translateY(16px);
  opacity: 0;
}

/* 选中正文后浮现的操作菜单：移动端固定在底部导航上方。 */
.novel-reader__selmenu {
  position: fixed;
  left: 50%;
  bottom: calc(var(--layout-bottom-nav-h, 52px) + 12px);
  z-index: 2300;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
  transform: translateX(-50%);

  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &:active {
      background: rgba(255, 255, 255, 0.16);
    }
  }
}

.novel-reader__selmenu-sep {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.22);
}

.novel-selmenu-enter-active,
.novel-selmenu-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.novel-selmenu-enter-from,
.novel-selmenu-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

/* 正文配图的大图预览：同样 Teleport 到 body，层级高于站点头与选中菜单。 */
.novel-reader__lightbox {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 14px;
  background: rgba(15, 23, 42, 0.86);
  cursor: zoom-out;
}

.novel-reader__lightbox-img {
  max-width: min(100%, 900px);
  max-height: calc(100vh - 92px);
  height: auto;
  border-radius: 10px;
  object-fit: contain;
}

.novel-reader__lightbox-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.novel-lightbox-enter-active,
.novel-lightbox-leave-active {
  transition: opacity 0.18s ease;
}

.novel-lightbox-enter-from,
.novel-lightbox-leave-to {
  opacity: 0;
}

/* ---------------------------------------------------------------------------
   阅读主题：根节点与 Teleport 出去的面板共用这几个类，
   覆盖 CSS 变量后，正文、顶栏、段评面板、设置面板、目录一起换肤。
   --------------------------------------------------------------------------- */
.novel-reader {
  background: var(--color-bg, #f5f6f7);
}

/* Teleport 出去的段评面板 / 设置面板 / 目录也挂 themeClass，同一选择器直接命中 */
.novel-reader--sepia {
  --color-card: #f7f0df;
  --color-bg: #f2e9d5;
  --color-text: #4a3b2a;
  --color-text-secondary: #6b5a44;
  --color-text-muted: #9a8768;
  --color-border: rgb(91 70 54 / 18%);
  --color-hover: rgb(91 70 54 / 8%);
  --accent: #9c6d2e;
  --accent-soft: rgb(156 109 46 / 12%);
}

.novel-reader--dark {
  --color-card: #242830;
  --color-bg: #191c21;
  --color-text: #d4d8de;
  --color-text-secondary: #a7aeb9;
  --color-text-muted: #767e8a;
  --color-border: rgb(255 255 255 / 10%);
  --color-hover: rgb(255 255 255 / 7%);
  --accent: #82aaff;
  --accent-soft: rgb(130 170 255 / 16%);
}

/* 夜间模式下图片压一点亮度，白底图不刺眼 */
.novel-reader--dark .novel-reader__para-img {
  filter: brightness(0.86);
}

/* ---------------------------------------------------------------------------
   阅读设置面板：移动端底部抽屉，桌面居中小卡
   --------------------------------------------------------------------------- */
.novel-reader__sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 2250;
  background: rgb(15 23 42 / 40%);
}

.novel-reader__sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2251;
  padding: 6px 16px calc(var(--layout-bottom-nav-h, 52px) + 12px);
  box-sizing: border-box;
  background: var(--color-card, #fff);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -4px 20px rgb(15 23 42 / 16%);
}

.novel-reader__sheet-grip {
  display: block;
  width: 38px;
  height: 4px;
  margin: 4px auto 10px;
  border-radius: 999px;
  background: var(--color-border, rgb(71 85 105 / 22%));
}

.novel-reader__sheet-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;

  & + & {
    border-top: 1px solid var(--color-border, rgb(71 85 105 / 12%));
  }
}

.novel-reader__sheet-label {
  flex-shrink: 0;
  width: 34px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
}

.novel-reader__sheet-themes {
  flex: 1;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.novel-reader__theme-dot {
  min-width: 58px;
  padding: 6px 10px;
  border: 1.5px solid var(--color-border, rgb(71 85 105 / 20%));
  border-radius: 999px;
  background: var(--color-bg, #f5f6f7);
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    color 0.14s ease;

  &--light {
    background: #ffffff;
  }

  &--sepia {
    background: #f2e9d5;
  }

  &--dark {
    background: #242830;
    color: #d4d8de;
  }

  &--on {
    border-color: var(--accent, #2c3d56);
    color: var(--accent, #2c3d56);
    box-shadow: 0 0 0 1px var(--accent, #2c3d56) inset;

    &.novel-reader__theme-dot--dark {
      color: #d4d8de;
    }
  }
}

.novel-reader__sheet-controls {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.novel-reader__sheet-value {
  min-width: 42px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
  font-variant-numeric: tabular-nums;
}

.novel-reader__sheet-btn {
  min-width: 44px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--color-border, rgb(71 85 105 / 18%));
  border-radius: 8px;
  background: var(--color-bg, #f5f6f7);
  color: var(--color-text, #1e293b);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &--on {
    border-color: var(--accent, #2c3d56);
    color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgb(44 61 86 / 8%));
  }
}

.novel-sheet-enter-active,
.novel-sheet-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.novel-sheet-enter-from,
.novel-sheet-leave-to {
  transform: translateY(24px);
  opacity: 0;
}

/* ---------------------------------------------------------------------------
   目录抽屉：左侧滑出
   --------------------------------------------------------------------------- */
.novel-reader__toc {
  position: fixed;
  top: var(--layout-header-h, 2.75rem);
  left: 0;
  bottom: 0;
  z-index: 2251;
  width: min(320px, 86vw);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--color-card, #fff);
  box-shadow: 4px 0 24px rgb(15 23 42 / 18%);
}

.novel-reader__toc-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border, rgb(71 85 105 / 12%));
}

.novel-reader__toc-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text, #1e293b);
}

.novel-reader__toc-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;

  &:active {
    background: var(--color-hover, rgb(44 61 86 / 8%));
  }
}

.novel-reader__toc-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  list-style: none;
  margin: 0;
  padding: 6px 0;
}

.novel-reader__toc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  border: none;
  background: transparent;
  color: var(--color-text, #1e293b);
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  &:active {
    background: var(--color-hover, rgb(44 61 86 / 6%));
  }

  &--current {
    background: var(--accent-soft, rgb(44 61 86 / 8%));
    color: var(--accent, #2c3d56);
    font-weight: 700;
  }
}

.novel-reader__toc-num {
  flex-shrink: 0;
  min-width: 26px;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
  font-variant-numeric: tabular-nums;
}

.novel-reader__toc-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-reader__toc-empty {
  padding: 20px;
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-reader__toc-more {
  flex-shrink: 0;
  width: 100%;
  padding: 10px;
  border: none;
  border-top: 1px solid var(--color-border, rgb(71 85 105 / 12%));
  background: var(--color-card, #fff);
  color: var(--accent, #2c3d56);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-toc-enter-active,
.novel-toc-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.novel-toc-enter-from,
.novel-toc-leave-to {
  transform: translateX(-24px);
  opacity: 0;
}

/* 桌面端：抽屉贴在站点头下方，正文同步让位，互不遮挡。 */
@media screen and (min-width: 769px) {
  .novel-reader__panel {
    top: calc(var(--layout-header-h, 2.75rem) + 8px);
    right: 0;
    bottom: 0;
    left: auto;
    width: 380px;
    max-width: calc(100vw - 24px);
    max-height: none;
    padding: 14px 16px 16px;
    border-radius: 14px 0 0 14px;
    box-shadow: -6px 0 24px rgb(15 23 42 / 18%);
  }

  .novel-reader__panel-grip {
    display: none;
  }

  .novel-panel-enter-from,
  .novel-panel-leave-to {
    transform: translateX(24px);
  }

  .novel-reader__selmenu {
    left: auto;
    bottom: auto;
  }

  .novel-selmenu-enter-from,
  .novel-selmenu-leave-to {
    transform: translate(-50%, 6px);
  }

  /* 面板打开时正文列变窄，不被抽屉压住 */
  .novel-reader--panel-open {
    max-width: min(720px, calc(100vw - 420px));
    margin-right: 400px;
    margin-left: auto;
  }

  /* 设置面板：桌面居中小卡 */
  .novel-reader__sheet {
    top: 50%;
    right: auto;
    left: 50%;
    bottom: auto;
    width: 380px;
    padding: 4px 20px 16px;
    border-radius: 14px;
    box-shadow: 0 12px 40px rgb(15 23 42 / 20%);
    transform: translate(-50%, -50%);
  }

  .novel-reader__sheet-grip {
    display: none;
  }

  .novel-sheet-enter-from,
  .novel-sheet-leave-to {
    transform: translate(-50%, -50%) scale(0.96);
  }
}
</style>
