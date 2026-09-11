<!-- eslint-disable vue/html-self-closing -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'

import { Icon } from '@iconify/vue'
import { uploadPhoto } from '@/api/editPostAndComment/utils'

import { showMsg } from '@/components/MessageBox'
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
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const modelValue = defineModel({
  type: String,
  required: true,
})

/* ---------------- 图片上传(点击/粘贴) ---------------- */

function openImagePicker() {
  fileInputRef.value?.click()
}

async function upload(file: File) {
  if (!file)
    return
  try {
    const data = await uploadPhoto(file)
    showMsg(data.message)
    insertAtCursor(`![${file.name}](${data.fileURL})`)
  }
  catch (error) {
    console.error('Error uploading file:', error)
    showMsg('上传失败，请重试')
  }
}

async function uploadFile(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  if (file)
    await upload(file)
  el.value = ''
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

/* ---------------- 格式化:行内包裹 + 行级前缀 + 块级插入 ---------------- */

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

/** 行内包裹型:有选中→包裹选区;无选中→插入占位并选中占位文字 */
const INLINE_WRAPPERS: Partial<Record<FormatKind, { token: string, placeholder: string }>> = {
  bold: { token: '**', placeholder: '粗体' },
  italic: { token: '*', placeholder: '斜体' },
  strike: { token: '~~', placeholder: '删除线' },
  code: { token: '`', placeholder: '代码' },
}

/** 行级前缀型:对选中区域涉及的每一行加/加不了就新起一行 */
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

defineExpose({ insertAtCursor })

/** 对选区涉及的行区间做前缀处理(GitHub 式:选中多行时逐行加前缀) */
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
    // 空行:插入「marker 占位」并选中占位文字
    insertAtCursor(`${marker}${placeholder}`, [-placeholder.length, 0])
    return
  }
  const lines = block.split('\n')
  const prefixed = lines.map((ln, i) => {
    const mk = marker === LINE_PREFIXES.ol!.marker ? `${i + 1}. ` : marker
    // 已有同名前缀的行不重复加(无序列表再点一次不加「- -」;撤销能力交给用户手删)
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
      // 已包裹则解开,否则包裹(GitHub 行为)
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

/* ---------------- 键盘:Ctrl+B/I/S、Ctrl+Enter 发送、回车续列表 ---------------- */

function handleKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey

  // 中文输入法合成中的回车/快捷键不拦截
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

  // 回车自动续列表(GitHub 式);Shift+Enter 交给软换行
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
    // 空列表项上回车:退出列表(清掉当前行的标记)
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

/** 评论区 compact：最少 4 行，最多 6 行，超出后框内滚动 */
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
    // 先重置高度再测量，避免 scrollHeight 被旧高度卡住
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
  const top = document.body.scrollTop
  const el = event.target as HTMLTextAreaElement
  modelValue.value = el.value
  autoResize()
  nextTick(() => {
    document.body.scrollTop = top
  })
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

watch(() => props.fill, () => {
  nextTick(autoResize)
})

watch(() => props.compact, () => {
  nextTick(autoResize)
})

watch(modelValue, () => {
  nextTick(autoResize)
})

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
      <!-- 左侧:格式化图标组(窄屏横向滑动) -->
      <div class="md-editor__tools" role="toolbar" aria-label="格式化工具">
        <button type="button" class="md-editor__tool" title="标题 (行首 ###)" @click="applyFormat('heading')">
          <span class="md-editor__glyph md-editor__glyph--h">H</span>
        </button>
        <button type="button" class="md-editor__tool" title="粗体 (Ctrl+B)" @click="applyFormat('bold')">
          <span class="md-editor__glyph md-editor__glyph--b">B</span>
        </button>
        <button type="button" class="md-editor__tool" title="斜体 (Ctrl+I)" @click="applyFormat('italic')">
          <span class="md-editor__glyph md-editor__glyph--i">I</span>
        </button>
        <button type="button" class="md-editor__tool" title="删除线 (Ctrl+S)" @click="applyFormat('strike')">
          <span class="md-editor__glyph md-editor__glyph--s">S</span>
        </button>
        <span class="md-editor__sep" aria-hidden="true" />
        <button type="button" class="md-editor__tool" title="引用" @click="applyFormat('quote')">
          <span class="md-editor__glyph">&ldquo;</span>
        </button>
        <button type="button" class="md-editor__tool" title="无序列表" @click="applyFormat('ul')">
          <span class="md-editor__glyph">&bull;</span>
        </button>
        <button type="button" class="md-editor__tool" title="有序列表" @click="applyFormat('ol')">
          <span class="md-editor__glyph md-editor__glyph--ol">1.</span>
        </button>
        <span class="md-editor__sep" aria-hidden="true" />
        <button type="button" class="md-editor__tool" title="代码 (Ctrl+E 可用反引号)" @click="applyFormat('code')">
          <span class="md-editor__glyph md-editor__glyph--code">&lt;/&gt;</span>
        </button>
        <button type="button" class="md-editor__tool" title="表格" @click="applyFormat('table')">
          <span class="md-editor__glyph md-editor__glyph--table">&#8865;</span>
        </button>
        <button type="button" class="md-editor__tool" title="分割线" @click="applyFormat('hr')">
          <span class="md-editor__glyph">&mdash;</span>
        </button>
      </div>

      <!-- 右侧:图片 / 预览 -->
      <div class="md-editor__tools-right">
        <button type="button" class="md-editor__tool" title="插入图片(可直接粘贴)" @click="openImagePicker">
          <Icon icon="tabler:photo" width="17" height="17" aria-hidden="true" />
        </button>
        <button
          v-if="musicEnabled"
          type="button"
          class="md-editor__tool"
          title="插入音乐"
          @click="emit('insertMusic')"
        >
          <Icon icon="tabler:disc" width="17" height="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="md-editor__tool md-editor__tool--toggle"
          :class="{ 'md-editor__tool--active': isPreview }"
          :title="isPreview ? '返回编辑' : '预览'"
          @click="isPreview = !isPreview"
        >
          <span class="md-editor__glyph md-editor__glyph--preview">{{ isPreview ? '编辑' : '预览' }}</span>
        </button>
        <input
          :id="fileInputId"
          ref="fileInput"
          type="file"
          accept="image/*"
          class="md-editor__file-input"
          @input="uploadFile"
        >
      </div>
    </div>

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
      <MarkdownContainer
        v-show="isPreview"
        class="md-editor__preview-pane"
        :markdown-content="modelValue || ''"
      />
    </div>

    <div v-if="!fill" class="md-editor__actions">
      <span class="md-editor__hint">Markdown · 图片可粘贴 · Ctrl+Enter 发送</span>
      <div
        class="md-editor__action md-editor__action--primary"
        :class="{ 'md-editor__action--busy': isBusy }"
        role="button"
        tabindex="0"
        @click="emitSend"
        @keydown.enter="emitSend"
      >
        {{ isBusy ? '发送中…' : '发送' }}
      </div>
    </div>
    <div v-else class="md-editor__actions md-editor__actions--fill">
      <span class="md-editor__fill-hint">支持 Markdown · 图片可粘贴 · Ctrl+Enter 发送</span>
      <div
        class="md-editor__action md-editor__action--primary"
        :class="{ 'md-editor__action--busy': isBusy }"
        role="button"
        tabindex="0"
        @click="emitSend"
        @keydown.enter="emitSend"
      >
        {{ isBusy ? '发送中…' : '发送' }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.md-editor {
  width: 100%;
}

/* ---------- 工具栏:单行,永不换行,窄屏横向滑动 ---------- */

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

  &--h { font-size: 13px; letter-spacing: 0; }
  &--b { font-weight: 700; }
  &--i { font-style: italic; font-family: Georgia, serif; }
  &--s { text-decoration: line-through; }
  &--ol { font-size: 12px; font-weight: 600; }
  &--code { font-size: 11px; font-family: ui-monospace, monospace; font-weight: 500; }
  &--table { font-size: 13px; }
  &--preview { font-size: 12px; font-weight: 500; padding: 0 2px; }
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

/* 非 compact / 非 fill：默认约 3 行起 */
.md-editor:not(.md-editor--compact):not(.md-editor--fill) .md-editor__body textarea {
  min-height: 96px;
  overflow: hidden;
}

.md-editor__body--preview {
  .md-editor__preview-pane {
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
  letter-spacing: 0;
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
  min-height: 0;
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
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 0, 0, 0.28) rgba(0, 0, 0, 0.06);

      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.06);
        border-radius: 4px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.28);
        border-radius: 4px;
      }
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
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.28) rgba(0, 0, 0, 0.06);

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.06);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.28);
      border-radius: 4px;
    }
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
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.28) rgba(0, 0, 0, 0.06);

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.06);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.28);
      border-radius: 3px;
    }
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
