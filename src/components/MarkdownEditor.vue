<!-- eslint-disable vue/html-self-closing -->
<script setup lang="ts">
import type { StaffAlias } from '@/api/staff/staff'

import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { uploadFile, uploadPhoto } from '@/api/editPostAndComment/utils'

import { showMsg } from '@/components/MessageBox'
import { primeMentionCache } from '@/composables/useMentionResolve'
import { useStaffAliases } from '@/composables/useStaffAliases'
import { buildMentionPrefix } from '@/utils/mention'
import LoadingSpinner from './LoadingSpinner.vue'
import MarkdownContainer from './MarkdownContainer.vue'

/**
 * Markdown 编辑器(GitHub/Discourse 式):
 * 单行图标工具栏 + 选中即包裹 + 键盘快捷键 + 列表自动续行 + 预览切换。
 * compact=评论区(2~6 行自动增高) / fill=发帖页(占满剩余高度)。
 */

const props = withDefaults(
  defineProps<{
    /** 提交请求进行中：禁用发送并显示「发送中」 */
    submitBusy?: boolean
    /** 评论区等场景：更紧凑的工具栏与输入框 */
    compact?: boolean
    /** 发帖页：占满父容器剩余高度 */
    fill?: boolean
    /** 显示「插入音乐」按钮（发帖页），点击向父组件发 insert-music 事件 */
    musicEnabled?: boolean
    placeholder?: string
  }>(),
  {
    submitBusy: false,
    compact: false,
    fill: false,
    musicEnabled: false,
    placeholder: '请输入正文',
  },
)

const emit = defineEmits<{
  send: []
  insertMusic: []
}>()

const isBusy = computed(() => props.submitBusy)

function emitSend() {
  if (isBusy.value)
    return
  emit('send')
}

const isPreview = ref(false)
const fileInputId = useId()
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput')
const fileUploadId = useId()
const fileUploadRef = useTemplateRef<HTMLInputElement>('fileUpload')
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const modelValue = defineModel({
  type: String,
  required: true,
})

/* ---------------- 图片上传(点击/粘贴) ---------------- */

// 上传中状态：工具栏按钮转圈、禁用重复点击，避免大图/动图上传期间无反馈
const imageUploading = ref(false)
const fileUploading = ref(false)

function openImagePicker() {
  if (imageUploading.value)
    return
  fileInputRef.value?.click()
}

async function upload(file: File) {
  if (!file || imageUploading.value)
    return
  imageUploading.value = true
  try {
    const data = await uploadPhoto(file)
    showMsg(data.message)
    insertAtCursor(`![${file.name}](${data.fileURL})`)
  }
  catch (error) {
    console.error('Error uploading file:', error)
    showMsg('上传失败，请重试')
  }
  finally {
    imageUploading.value = false
  }
}

async function handleImageUpload(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  if (file)
    await upload(file)
  el.value = ''
}

function openFilePicker() {
  if (fileUploading.value)
    return
  fileUploadRef.value?.click()
}

async function handleFileUpload(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  if (!file || fileUploading.value)
    return
  fileUploading.value = true
  try {
    const data = await uploadFile(file)
    showMsg(data.message)
    insertAtCursor(`[${file.name}](${data.fileURL})`)
  }
  catch (error) {
    console.error('Error uploading file:', error)
    showMsg('上传失败，请重试')
  }
  finally {
    fileUploading.value = false
    el.value = ''
  }
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items)
    return
  for (let i = 0; i < items.length; ++i) {
    const item = items[i]
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (!file)
        return
      event.preventDefault()
      await upload(file)
    }
  }
}

/* ---------------- 格式化 ---------------- */

type FormatKind
  = | 'heading'
    | 'bold'
    | 'italic'
    | 'strike'
    | 'quote'
    | 'ul'
    | 'ol'
    | 'table'
    | 'hr'
    | 'code'

const INLINE_WRAPPERS: Partial<Record<FormatKind, { token: string, placeholder: string }>> = {
  bold: { token: '**', placeholder: '粗体' },
  italic: { token: '*', placeholder: '斜体' },
  strike: { token: '~~', placeholder: '删除线' },
  code: { token: '`', placeholder: '代码' },
}

const LINE_PREFIXES: Partial<Record<FormatKind, { marker: string, placeholder: string }>> = {
  heading: { marker: '### ', placeholder: '标题' },
  quote: { marker: '> ', placeholder: '引用' },
  ul: { marker: '- ', placeholder: '列表项' },
  ol: { marker: '1. ', placeholder: '列表项' },
}

function insertAtCursor(text: string, selectOffset?: [number, number]) {
  const el = textarea.value
  if (!el)
    return
  const s = el.selectionStart
  const e = el.selectionEnd
  modelValue.value = modelValue.value.slice(0, s) + text + modelValue.value.slice(e)
  const base = s + text.length
  const [from, to] = selectOffset ?? [0, 0]
  nextTick(() => {
    el.focus()
    el.setSelectionRange(base + from, base + to)
  })
}

function prefixLines(marker: string, placeholder: string) {
  const el = textarea.value
  if (!el)
    return
  const value = modelValue.value
  const s = el.selectionStart
  const e = el.selectionEnd
  const lineStart = value.lastIndexOf('\n', s - 1) + 1
  const lineEndRaw = value.indexOf('\n', e)
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw
  const block = value.slice(lineStart, lineEnd)
  const isEmpty = s === e && block.trim() === ''

  if (isEmpty) {
    insertAtCursor(`${marker}${placeholder}`, [-placeholder.length, 0])
    return
  }
  const lines = block.split('\n')
  const prefixed = lines.map((ln, i) => {
    const mk = marker === LINE_PREFIXES.ol!.marker ? `${i + 1}. ` : marker
    return mk + ln
  })
  const next = prefixed.join('\n')
  modelValue.value = value.slice(0, lineStart) + next + value.slice(lineEnd)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(lineStart, lineStart + next.length)
  })
}

function applyFormat(kind: FormatKind) {
  const el = textarea.value
  if (!el)
    return
  if (isPreview.value)
    isPreview.value = false

  const inline = INLINE_WRAPPERS[kind]
  if (inline) {
    const s = el.selectionStart
    const e = el.selectionEnd
    if (s !== e) {
      const sel = modelValue.value.slice(s, e)
      if (sel.startsWith(inline.token) && sel.endsWith(inline.token) && sel.length >= inline.token.length * 2) {
        const inner = sel.slice(inline.token.length, -inline.token.length)
        modelValue.value = modelValue.value.slice(0, s) + inner + modelValue.value.slice(e)
        nextTick(() => {
          el.focus()
          el.setSelectionRange(s, s + inner.length)
        })
      }
      else {
        modelValue.value = `${modelValue.value.slice(0, s)}${inline.token}${sel}${inline.token}${modelValue.value.slice(e)}`
        nextTick(() => {
          el.focus()
          el.setSelectionRange(s + inline.token.length, s + inline.token.length + sel.length)
        })
      }
      return
    }
    insertAtCursor(`${inline.token}${inline.placeholder}${inline.token}`, [
      -inline.placeholder.length - inline.token.length,
      -inline.token.length,
    ])
    return
  }

  const line = LINE_PREFIXES[kind]
  if (line) {
    prefixLines(line.marker, line.placeholder)
    return
  }

  if (kind === 'table') {
    insertAtCursor('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n')
    return
  }
  if (kind === 'hr') {
    insertAtCursor('\n---\n')
  }
}

/* ---------------- @ 职位提及（居中/轻量弹窗） ---------------- */

const { staffAliases } = useStaffAliases()
const mentionOpen = ref(false)
const mentionFilter = ref('')
const mentionInputRef = useTemplateRef<HTMLInputElement>('mentionInput')

const filteredStaffAliases = computed(() => {
  const q = mentionFilter.value.trim().toLowerCase()
  if (!q)
    return staffAliases.value
  return staffAliases.value.filter(
    a => a.alias.toLowerCase().includes(q) || a.title.toLowerCase().includes(q),
  )
})

const MENTION_PAGE_SIZE = 5
const mentionPage = ref(1)

const totalMentionPages = computed(() =>
  Math.max(1, Math.ceil(filteredStaffAliases.value.length / MENTION_PAGE_SIZE)),
)

const pagedStaffAliases = computed(() => {
  const start = (mentionPage.value - 1) * MENTION_PAGE_SIZE
  return filteredStaffAliases.value.slice(start, start + MENTION_PAGE_SIZE)
})

function prevMentionPage() {
  if (mentionPage.value > 1)
    mentionPage.value--
}

function nextMentionPage() {
  if (mentionPage.value < totalMentionPages.value)
    mentionPage.value++
}

watch(mentionFilter, () => {
  mentionPage.value = 1
})

watch(mentionOpen, (open) => {
  if (open) {
    mentionPage.value = 1
    if (isPreview.value)
      isPreview.value = false
    // 聚焦时防止页面滚动
    nextTick(() => mentionInputRef.value?.focus({ preventScroll: true }))
  }
})

function closeMention() {
  mentionOpen.value = false
  // 关闭后重新聚焦到输入框，保持连贯体验
  nextTick(() => textarea.value?.focus({ preventScroll: true }))
}

function toggleMention() {
  mentionOpen.value = !mentionOpen.value
  if (mentionOpen.value) {
    mentionFilter.value = ''
  }
}

function pickStaffAlias(a: StaffAlias) {
  insertAtCursor(buildMentionPrefix(a.alias))
  primeMentionCache(a.alias, a.userID)
  closeMention()
}

// 暴露关闭方法给父组件，方便父组件“收起”时同步关闭弹窗
defineExpose({ insertAtCursor, closeMention })

/* ---------------- 键盘 ---------------- */

function handleKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey

  if (event.isComposing)
    return

  if (mod && event.key === 'Enter') {
    event.preventDefault()
    emitSend()
    return
  }

  if (mod && !event.shiftKey && !event.altKey) {
    const k = event.key.toLowerCase()
    if (k === 'b' || k === 'i' || k === 's') {
      event.preventDefault()
      applyFormat(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'strike')
      return
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    const el = textarea.value
    if (!el)
      return
    const s = el.selectionStart
    const e = el.selectionEnd
    if (s !== e)
      return
    const upto = modelValue.value.slice(0, s)
    const lineStart = upto.lastIndexOf('\n') + 1
    const curLine = upto.slice(lineStart)
    const m = curLine.match(/^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/)
    if (!m)
      return
    event.preventDefault()
    const rest = m[4]
    if (!rest) {
      modelValue.value = modelValue.value.slice(0, lineStart) + modelValue.value.slice(s)
      nextTick(() => {
        el.focus()
        el.setSelectionRange(lineStart, lineStart)
      })
      return
    }
    let marker = m[2]
    if (/\d/.test(marker))
      marker = marker.replace(/\d+/, String(Number.parseInt(marker) + 1))
    const insert = `\n${m[1]}${marker} `
    modelValue.value = upto + insert + modelValue.value.slice(s)
    nextTick(() => {
      el.focus()
      el.setSelectionRange(s + insert.length, s + insert.length)
    })
  }
}

/* ---------------- 自动增高 ---------------- */

const COMPACT_MIN_LINES = 4
const COMPACT_MAX_LINES = 6

function getCompactLineMetrics(el: HTMLTextAreaElement) {
  const style = window.getComputedStyle(el)
  const lineHeight = Number.parseFloat(style.lineHeight) || 21
  const paddingTop = Number.parseFloat(style.paddingTop) || 10
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 10
  return { lineHeight, padding: paddingTop + paddingBottom }
}

function autoResize() {
  if (!textarea.value)
    return
  const el = textarea.value
  if (props.fill) {
    el.style.height = ''
    el.style.maxHeight = ''
    el.style.overflowY = ''
    return
  }
  if (props.compact) {
    const { lineHeight, padding } = getCompactLineMetrics(el)
    const minH = Math.ceil(padding + lineHeight * COMPACT_MIN_LINES)
    const maxH = Math.ceil(padding + lineHeight * COMPACT_MAX_LINES)
    el.style.minHeight = `${minH}px`
    el.style.maxHeight = `${maxH}px`
    el.style.height = 'auto'
    el.style.overflowY = 'hidden'
    const scrollH = el.scrollHeight
    const next = Math.min(maxH, Math.max(minH, scrollH))
    el.style.height = `${next}px`
    el.style.overflowY = scrollH > maxH ? 'auto' : 'hidden'
    return
  }
  el.style.minHeight = ''
  el.style.maxHeight = ''
  const minHeight = 450
  el.style.height = `${minHeight}px`
  el.style.overflowY = 'hidden'
  el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
}

function handleInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  modelValue.value = el.value
  autoResize()
}

onMounted(() => {
  nextTick(() => {
    autoResize()
    requestAnimationFrame(() => autoResize())
  })
})

watch(textarea, (el) => {
  if (el)
    nextTick(() => autoResize())
})

watch(() => props.fill, () => nextTick(autoResize))
watch(() => props.compact, () => nextTick(autoResize))
watch(modelValue, () => nextTick(autoResize))
watch(isPreview, (preview) => {
  if (!preview)
    nextTick(autoResize)
})
</script>

<template>
  <div
    id="mdRoot"
    class="md-editor"
    :class="{ 'md-editor--compact': compact, 'md-editor--fill': fill }"
  >
    <div class="md-editor__toolbar">
      <div class="md-editor__tools" role="toolbar" aria-label="格式化工具">
        <button type="button" class="md-editor__tool" title="标题 (行首 ###)" @mousedown.prevent @click="applyFormat('heading')">
          <span class="md-editor__glyph md-editor__glyph--h">H</span>
        </button>
        <button type="button" class="md-editor__tool" title="粗体 (Ctrl+B)" @mousedown.prevent @click="applyFormat('bold')">
          <span class="md-editor__glyph md-editor__glyph--b">B</span>
        </button>
        <button type="button" class="md-editor__tool" title="斜体 (Ctrl+I)" @mousedown.prevent @click="applyFormat('italic')">
          <span class="md-editor__glyph md-editor__glyph--i">I</span>
        </button>
        <button type="button" class="md-editor__tool" title="删除线 (Ctrl+S)" @mousedown.prevent @click="applyFormat('strike')">
          <span class="md-editor__glyph md-editor__glyph--s">S</span>
        </button>
        <span class="md-editor__sep" aria-hidden="true" />
        <button type="button" class="md-editor__tool" title="引用" @mousedown.prevent @click="applyFormat('quote')">
          <span class="md-editor__glyph">&ldquo;</span>
        </button>
        <button type="button" class="md-editor__tool" title="无序列表" @mousedown.prevent @click="applyFormat('ul')">
          <span class="md-editor__glyph">&bull;</span>
        </button>
        <button type="button" class="md-editor__tool" title="有序列表" @mousedown.prevent @click="applyFormat('ol')">
          <span class="md-editor__glyph md-editor__glyph--ol">1.</span>
        </button>
        <span class="md-editor__sep" aria-hidden="true" />
        <button type="button" class="md-editor__tool" title="代码 (Ctrl+E 可用反引号)" @mousedown.prevent @click="applyFormat('code')">
          <span class="md-editor__glyph md-editor__glyph--code">&lt;/&gt;</span>
        </button>
        <button type="button" class="md-editor__tool" title="表格" @mousedown.prevent @click="applyFormat('table')">
          <span class="md-editor__glyph md-editor__glyph--table">&#8865;</span>
        </button>
        <button type="button" class="md-editor__tool" title="分割线" @mousedown.prevent @click="applyFormat('hr')">
          <span class="md-editor__glyph">&mdash;</span>
        </button>
      </div>

      <div class="md-editor__tools-right">
        <button
          v-if="staffAliases.length > 0"
          type="button"
          class="md-editor__tool"
          :class="{ 'md-editor__tool--active': mentionOpen }"
          title="@ 职位（匿名）"
          aria-haspopup="dialog"
          :aria-expanded="mentionOpen"
          @mousedown.prevent
          @click="toggleMention"
        >
          <span class="md-editor__glyph md-editor__glyph--at">@</span>
        </button>
        <button type="button" class="md-editor__tool" :disabled="imageUploading" :title="imageUploading ? '图片上传中…' : '插入图片(可直接粘贴)'" @mousedown.prevent @click="openImagePicker">
          <LoadingSpinner v-if="imageUploading" :size="17" />
          <Icon v-else icon="tabler:photo" width="17" height="17" aria-hidden="true" />
        </button>
        <button type="button" class="md-editor__tool" :disabled="fileUploading" :title="fileUploading ? '文件上传中…' : '上传文件'" @mousedown.prevent @click="openFilePicker">
          <LoadingSpinner v-if="fileUploading" :size="17" />
          <Icon v-else icon="tabler:paperclip" width="17" height="17" aria-hidden="true" />
        </button>
        <button
          v-if="musicEnabled"
          type="button"
          class="md-editor__tool"
          title="插入音乐"
          @mousedown.prevent
          @click="emit('insertMusic')"
        >
          <Icon icon="tabler:disc" width="17" height="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="md-editor__tool md-editor__tool--toggle"
          :class="{ 'md-editor__tool--active': isPreview }"
          :title="isPreview ? '返回编辑' : '预览'"
          @mousedown.prevent
          @click="isPreview = !isPreview"
        >
          <span class="md-editor__glyph md-editor__glyph--preview">{{ isPreview ? '编辑' : '预览' }}</span>
        </button>
        <input :id="fileInputId" ref="fileInput" type="file" accept="image/*" class="md-editor__file-input" @input="handleImageUpload">
        <input :id="fileUploadId" ref="fileUpload" type="file" class="md-editor__file-input" @input="handleFileUpload">
      </div>
    </div>

    <!-- @ 抽屉：使用 Teleport 传送到 body，彻底避免父容器裁剪和层级问题 -->
    <Teleport to="body">
      <div v-if="mentionOpen && staffAliases.length > 0" class="md-editor__mention-overlay" @click.self="closeMention">
        <div class="md-editor__mention-drawer" role="dialog" aria-modal="true" aria-label="选择要 @ 的职位">
          <div class="md-editor__mention-head">
            <span class="md-editor__mention-caption">要 @ 哪个职位？</span>
            <button type="button" class="md-editor__mention-close" @click="closeMention">
              <Icon icon="tabler:x" width="20" height="20" />
            </button>
          </div>

          <div v-if="staffAliases.length > 6" class="md-editor__mention-search-wrap">
            <input
              ref="mentionInput"
              v-model="mentionFilter"
              class="md-editor__mention-search"
              type="search"
              placeholder="搜索职位或别名…"
              aria-label="搜索职位"
            >
          </div>

          <ul class="md-editor__mention-list">
            <li v-for="a in pagedStaffAliases" :key="a.aliasID" class="md-editor__mention-row">
              <button type="button" class="md-editor__mention-item" @click="pickStaffAlias(a)">
                <span class="md-editor__mention-alias">@{{ a.alias }}</span>
                <span class="md-editor__mention-title">{{ a.title }}</span>
              </button>
            </li>
            <li v-if="filteredStaffAliases.length === 0" class="md-editor__mention-empty">
              没有匹配的职位
            </li>
          </ul>

          <div v-if="totalMentionPages > 1" class="md-editor__mention-pager">
            <button type="button" class="md-editor__mention-page-btn" :disabled="mentionPage <= 1" @click="prevMentionPage">
              上一页
            </button>
            <span class="md-editor__mention-page-info">{{ mentionPage }} / {{ totalMentionPages }}</span>
            <button type="button" class="md-editor__mention-page-btn" :disabled="mentionPage >= totalMentionPages" @click="nextMentionPage">
              下一页
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="md-editor__body" :class="{ 'md-editor__body--preview': isPreview }">
      <textarea
        v-show="!isPreview"
        ref="textarea"
        :value="modelValue"
        :placeholder="placeholder"
        @input="handleInput"
        @paste="handlePaste"
        @keydown="handleKeydown"
      />
      <MarkdownContainer v-show="isPreview" class="md-editor__preview-pane" :markdown-content="modelValue || ''" />
    </div>

    <div v-if="!fill" class="md-editor__actions">
      <span class="md-editor__hint">Markdown · 图片可粘贴 · Ctrl+Enter 发送</span>
      <div class="md-editor__action md-editor__action--primary" :class="{ 'md-editor__action--busy': isBusy }" role="button" tabindex="0" @click="emitSend" @keydown.enter="emitSend">
        {{ isBusy ? '发送中…' : '发送' }}
      </div>
    </div>
    <div v-else class="md-editor__actions md-editor__actions--fill">
      <span class="md-editor__fill-hint">支持 Markdown · 图片可粘贴 · Ctrl+Enter 发送</span>
      <div class="md-editor__action md-editor__action--primary" :class="{ 'md-editor__action--busy': isBusy }" role="button" tabindex="0" @click="emitSend" @keydown.enter="emitSend">
        {{ isBusy ? '发送中…' : '发送' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.md-editor {
  position: relative;
  width: 100%;
}

/* ---------- 工具栏 ---------- */

.md-editor__toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.md-editor__tools,
.md-editor__tools-right {
  display: flex;
  gap: 2px;
  align-items: center;
  min-width: 0;
}

.md-editor__tools {
  flex: 1 1 auto;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 1px;
  &::-webkit-scrollbar {
    display: none;
  }
}

.md-editor__tools-right {
  flex-shrink: 0;
}

.md-editor__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text-secondary);
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
  }
  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  &--active {
    background: var(--chat-accent-soft);
    border-color: var(--chat-border-strong);
    color: var(--chat-accent);
  }
}

.md-editor__glyph {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  user-select: none;
  &--h {
    font-size: 13px;
  }
  &--b {
    font-weight: 700;
  }
  &--i {
    font-style: italic;
    font-family: Georgia, serif;
  }
  &--s {
    text-decoration: line-through;
  }
  &--ol {
    font-size: 12px;
  }
  &--code {
    font-size: 11px;
    font-family: ui-monospace, monospace;
  }
  &--table {
    font-size: 13px;
  }
  &--preview {
    font-size: 12px;
    font-weight: 500;
    padding: 0 2px;
  }
  &--at {
    font-size: 15px;
    font-weight: 700;
  }
}

.md-editor__sep {
  flex-shrink: 0;
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--chat-border);
}

.md-editor__file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* ---------- @ 弹窗样式（全新） ---------- */

.md-editor__mention-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.md-editor__mention-drawer {
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--chat-bg-main);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;
}

.md-editor__mention-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.md-editor__mention-caption {
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
}

.md-editor__mention-close {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--chat-text-tips);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  &:hover {
    background: var(--chat-bg-highlight);
    color: var(--chat-text);
  }
}

.md-editor__mention-search-wrap {
  margin-bottom: 12px;
}

.md-editor__mention-search {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-highlight);
  color: var(--chat-text);
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px var(--chat-accent-soft);
  }
}

.md-editor__mention-list {
  flex: 1;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  min-height: 0;
}

.md-editor__mention-row {
  width: 100%;
}

.md-editor__mention-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--chat-accent-soft);
  }
}

.md-editor__mention-alias {
  font-size: 15px;
  font-weight: 600;
  color: var(--chat-accent);
}

.md-editor__mention-title {
  font-size: 13px;
  color: var(--chat-text-tips);
}

.md-editor__mention-empty {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--chat-text-tips);
}

.md-editor__mention-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 12px;
  margin-top: 4px;
  border-top: 1px solid var(--chat-border);
}

.md-editor__mention-page-btn {
  min-width: 60px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--chat-border);
  border-radius: 6px;
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--chat-accent-soft);
    border-color: var(--chat-border-strong);
    color: var(--chat-accent);
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.md-editor__mention-page-info {
  font-size: 13px;
  color: var(--chat-text-tips);
  user-select: none;
}

/* ---------- 移动端适配：居中弹窗 ---------- */
@media screen and (max-width: 768px) {
  .md-editor__mention-overlay {
    align-items: center;
  }

  .md-editor__mention-drawer {
    width: 90%;
    max-width: 360px;
    max-height: 60vh;
    border-radius: 16px;
    padding-bottom: 16px;
    animation: fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .md-editor__mention-item {
    padding: 14px 10px;
  }
}

/* ---------- 桌面端适配：透明点击层，避免遮挡输入框 ---------- */
@media screen and (min-width: 769px) {
  .md-editor__mention-overlay {
    background: transparent; /* 桌面端去掉暗色遮罩 */
    backdrop-filter: none; /* 去掉模糊，避免干扰视觉 */
  }

  .md-editor__mention-drawer {
    width: 360px;
    max-height: 400px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); /* 加强阴影，突出浮层 */
    border: 1px solid var(--chat-border);
  }
}

/* ---------- 输入区 ---------- */

.md-editor__body {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0;

  textarea {
    flex: 0 0 auto;
    width: 100%;
    border: 1px solid var(--chat-border);
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--chat-bg-highlight);
    color: var(--chat-text);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    box-sizing: border-box;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;

    &::placeholder {
      color: var(--chat-text-tips);
    }
    &:focus {
      outline: none;
      border-color: var(--chat-accent);
      box-shadow: 0 0 0 2px var(--chat-accent-soft);
    }
  }
}

.md-editor:not(.md-editor--compact):not(.md-editor--fill) .md-editor__body textarea {
  min-height: 96px;
  overflow: hidden;
}

.md-editor__body--preview .md-editor__preview-pane {
  flex: 1 1 auto;
  width: 100%;
  min-height: 96px;
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  box-sizing: border-box;
  overflow: auto;
}

.md-editor--fill .md-editor__body--preview .md-editor__preview-pane {
  min-height: 240px;
}

/* ---------- 底部动作行 ---------- */

.md-editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
}

.md-editor__hint {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--chat-text-tips);
  line-height: 1.4;
}

.md-editor__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  min-height: 34px;
  padding: 7px 18px;
  border-radius: 8px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: var(--chat-accent-soft);
    border-color: var(--chat-border-strong);
    color: var(--chat-accent);
  }
  &--primary {
    background: var(--chat-accent);
    border-color: var(--chat-accent);
    color: var(--chat-bg-highlight);
    &:hover {
      opacity: 0.92;
      color: var(--chat-bg-highlight);
    }
  }
  &--busy {
    opacity: 0.7;
    cursor: wait;
    pointer-events: none;
  }
}

/* ---------- 发帖页 fill 模式 ---------- */

.md-editor--fill {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 300px; /* 增加防塌陷兜底 */
  height: 100%;

  .md-editor__toolbar {
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .md-editor__body {
    flex: 1 1 auto;
    min-height: clamp(220px, 42vh, 520px);
    flex-direction: column;
    overflow: hidden;

    textarea {
      flex: 1 1 auto;
      min-height: clamp(200px, 38vh, 480px);
      height: auto;
      max-height: none;
      resize: none;
      overflow: auto;
      font-size: 15px;
      line-height: 1.55;
      padding: 12px 14px;
      border-radius: 10px 10px 0 0;
      border-bottom: none;
    }
  }

  .md-editor__body--preview .md-editor__preview-pane {
    flex: 1 1 auto;
    min-height: clamp(200px, 38vh, 480px);
    height: auto;
    max-height: none;
    overflow: auto;
    font-size: 15px;
    padding: 12px 14px;
    border-radius: 10px 10px 0 0;
    border-bottom: none;
  }
}

.md-editor__actions--fill {
  flex-shrink: 0;
  margin-top: 0;
  padding: 10px 12px;
  justify-content: space-between;
  border: 1px solid var(--chat-border);
  border-top: none;
  border-radius: 0 0 10px 10px;
  background: var(--chat-bg-main);
}

.md-editor__fill-hint {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--chat-text-tips);
  line-height: 1.4;
}

/* ---------- 评论区 compact ---------- */

.md-editor--compact {
  .md-editor__toolbar {
    margin-bottom: 6px;
  }
  .md-editor__body textarea {
    min-height: calc(20px + 1.5em * 4);
    max-height: calc(20px + 1.5em * 6);
    height: auto;
    font-size: 14px;
    line-height: 1.5;
    overflow-y: hidden;
  }
  .md-editor__body--preview .md-editor__preview-pane {
    min-height: calc(20px + 1.5em * 4);
    max-height: calc(20px + 1.5em * 6);
    overflow-y: auto;
  }
  .md-editor__actions {
    margin-top: 6px;
  }
  .md-editor__action {
    min-width: 72px;
    min-height: 32px;
    padding: 6px 16px;
  }
}

@media screen and (max-width: 768px) {
  .md-editor__actions {
    justify-content: stretch;
  }
  .md-editor__action {
    flex: 1;
  }
  .md-editor__hint {
    display: none;
  }
}
</style>
