<script lang="ts" setup>
import type { NovelChapterDetail, NovelCommentItem, NovelParagraphItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createNovelComment,
  getNovelChapter,
  getNovelComments,
  reportNovelProgress,
  toggleShelf,
} from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import NovelCommentCard from '@/components/novel/NovelCommentCard.vue'
import { useUserStore } from '@/store/userStore'
import { novelBookPath } from '@/utils/novelRoute'
import { formatNovelTime, formatWordCount, novelParagraphExcerpt } from '@/utils/novelText'
import { setTitle } from '@/utils/title'
import { setWindowScrollY } from '@/utils/windowScroll'

defineOptions({ name: 'NovelReaderView' })

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const SETTINGS_KEY = 'novel-reader-settings'
const FONT_SIZES = [15, 17, 19, 21]
const PROGRESS_REPORT_MS = 12000

interface ReaderSettings {
  fontIndex: number
  wideLine: boolean
}

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw)
      return { fontIndex: 1, wideLine: false }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    const fontIndex = Number(parsed.fontIndex)
    return {
      fontIndex: Number.isFinite(fontIndex) && fontIndex >= 0 && fontIndex < FONT_SIZES.length ? fontIndex : 1,
      wideLine: Boolean(parsed.wideLine),
    }
  }
  catch {
    return { fontIndex: 1, wideLine: false }
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

/** 阅读进度 */
const furthestIndex = ref(0)
let observer: IntersectionObserver | null = null
let progressTimer: ReturnType<typeof setTimeout> | null = null
let lastReportedPercent = -1

const chapterID = computed(() => Number(route.params.chapterID) || 0)
const paragraphs = computed(() => detail.value?.paragraphs ?? [])
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

function cycleFontSize() {
  settings.value.fontIndex = (settings.value.fontIndex + 1) % FONT_SIZES.length
  saveSettings()
}

function toggleLineHeight() {
  settings.value.wideLine = !settings.value.wideLine
  saveSettings()
}

function scheduleProgress() {
  if (progressTimer)
    return
  progressTimer = setTimeout(() => {
    progressTimer = null
    void flushProgress()
  }, PROGRESS_REPORT_MS)
}

async function flushProgress() {
  if (!detail.value || furthestIndex.value <= 0)
    return
  const percent = progressPercent.value
  if (percent === lastReportedPercent)
    return
  lastReportedPercent = percent
  await reportNovelProgress({
    novelID: detail.value.novelID,
    chapterID: detail.value.chapter.chapterID,
    paragraphIndex: furthestIndex.value,
    percent,
  })
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
  loading.value = true
  activeParagraph.value = null
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

onMounted(loadChapter)

onUnmounted(() => {
  if (progressTimer)
    clearTimeout(progressTimer)
  observer?.disconnect()
  void flushProgress()
})
</script>

<template>
  <div v-if="detail" class="novel-zone novel-reader">
    <header class="novel-reader__bar">
      <RouterLink class="novel-reader__bar-btn" :to="novelBookPath(detail.novelID)">
        <Icon icon="tabler:chevron-left" width="18" height="18" aria-hidden="true" />
      </RouterLink>
      <div class="novel-reader__bar-title">
        <span class="novel-reader__bar-book">{{ detail.novelTitle }}</span>
        <span class="novel-reader__bar-chapter">{{ detail.chapter.chapterNum }}. {{ detail.chapter.title }}</span>
      </div>
      <div class="novel-reader__bar-actions">
        <button type="button" class="novel-reader__bar-btn" title="字号" @click="cycleFontSize">
          <Icon icon="tabler:typography" width="18" height="18" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="novel-reader__bar-btn"
          :class="{ 'novel-reader__bar-btn--on': settings.wideLine }"
          title="行距"
          @click="toggleLineHeight"
        >
          <Icon icon="tabler:line-height" width="18" height="18" aria-hidden="true" />
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
        :data-index="p.index"
        @click="openParagraph(p)"
      >
        <span class="novel-reader__para-text">{{ p.text }}</span><button
          type="button"
          class="novel-reader__bubble"
          :class="{ 'novel-reader__bubble--on': p.commentNum > 0 }"
          :title="p.commentNum > 0 ? `${p.commentNum} 条段评` : '评论这一段'"
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

    <div v-if="activeParagraph" class="novel-reader__mask" @click="closePanel" />
    <Transition name="novel-panel">
      <section v-if="activeParagraph" class="novel-reader__panel" aria-label="段落评论">
        <header class="novel-reader__panel-head">
          <div class="novel-reader__panel-para">
            <span class="novel-reader__panel-num">第 {{ activeParagraph.index + 1 }} 段</span>
            <p class="novel-reader__panel-excerpt">
              {{ novelParagraphExcerpt(activeParagraph.text, 60) }}
            </p>
          </div>
          <button type="button" class="novel-reader__panel-close" aria-label="关闭" @click="closePanel">
            <Icon icon="tabler:x" width="18" height="18" aria-hidden="true" />
          </button>
        </header>

        <div class="novel-reader__panel-form">
          <textarea
            v-model="draft"
            class="novel-reader__panel-input"
            rows="3"
            maxlength="500"
            placeholder="对这一段说点什么（最多 500 字）"
          />
          <button
            type="button"
            class="novel-reader__panel-submit"
            :disabled="draftBusy"
            @click="submitParagraphComment"
          >
            {{ draftBusy ? '发送中…' : '发布段评' }}
          </button>
        </div>

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
              @deleted="activeParagraph!.commentNum -= 1; detail!.chapter.commentNum -= 1"
            />
          </ul>
          <p v-else class="novel-reader__panel-empty">
            这一段还没有评论
          </p>
        </div>
      </section>
    </Transition>
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

.novel-reader__para {
  margin: 0 0 14px;
  text-indent: 2em;
  word-break: break-word;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s ease;

  &:active {
    background: var(--color-hover, rgba(44, 61, 86, 0.06));
  }
}

/* 段评气泡跟在段落末尾，绝对定位会在长段落上压住正文。 */
.novel-reader__para-text {
  display: inline;
}

.novel-reader__bubble {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
  padding: 1px 7px;
  border: none;
  border-radius: 999px;
  background: var(--color-hover, rgba(44, 61, 86, 0.06));
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
  cursor: pointer;
  vertical-align: 0.15em;

  &--on {
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
    color: var(--accent, #2c3d56);
    font-weight: 700;
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

.novel-reader__mask {
  position: fixed;
  inset: 0;
  z-index: 2200;
  background: rgba(15, 23, 42, 0.4);
}

.novel-reader__panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2201;
  max-height: min(72vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 12px 12px calc(var(--layout-bottom-nav-h, 52px) + 12px);
  box-sizing: border-box;
  background: var(--color-card, #fff);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.16);
}

.novel-reader__panel-head {
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
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
}

.novel-reader__panel-form {
  padding: 8px 0;
}

.novel-reader__panel-input {
  width: 100%;
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
  margin-top: 6px;
  padding: 7px 14px;
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

/* 桌面端：评论面板改为右侧抽屉，不遮挡正文；移动端保持底部抽屉。 */
@media screen and (min-width: 769px) {
  .novel-reader__panel {
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    width: 400px;
    max-width: calc(100vw - 24px);
    max-height: none;
    padding: 16px 16px 20px;
    border-radius: 14px 0 0 14px;
    box-shadow: -6px 0 24px rgba(15, 23, 42, 0.18);
  }

  .novel-panel-enter-from,
  .novel-panel-leave-to {
    transform: translateX(24px);
  }
}
</style>
