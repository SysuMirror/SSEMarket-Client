<!-- eslint-disable vue/html-self-closing -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'

import { uploadPhoto } from '@/api/editPostAndComment/utils'

import { showMsg } from '@/components/MessageBox'
import MarkdownContainer from './MarkdownContainer.vue'

const props = withDefaults(
  defineProps<{
    /** 提交请求进行中：禁用发送并显示「发送中」 */
    submitBusy?: boolean
    /** 评论区等场景：更紧凑的工具栏与输入框 */
    compact?: boolean
    /** 发帖页：占满父容器剩余高度 */
    fill?: boolean
    placeholder?: string
  }>(),
  {
    submitBusy: false,
    compact: false,
    fill: false,
    placeholder: '请输入正文',
  },
)

const emit = defineEmits<{
  send: []
}>()

/** 点击瞬间置位，避免等父组件 prop 回传前重复触发 send */
const sending = ref(false)

const isBusy = computed(() => props.submitBusy || sending.value)

function emitSend() {
  if (isBusy.value)
    return
  sending.value = true
  emit('send')
}

watch(
  () => props.submitBusy,
  (busy) => {
    if (!busy)
      sending.value = false
  },
)

// const route = useRoute()

type EditType = '标题' | '粗体' | '斜体' | '删除线' | '引用' | '无序列表' | '有序列表' | '表格' | '分割线' | '代码块'

const isPreview = ref(false)
const formatExpanded = ref(false)
const fileInputId = useId()
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput')
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

function openImagePicker() {
  fileInputRef.value?.click()
}

const formatActions: { type: EditType, label: string }[] = [
  { type: '标题', label: '标题' },
  { type: '粗体', label: '粗体' },
  { type: '斜体', label: '斜体' },
  { type: '删除线', label: '删除线' },
  { type: '引用', label: '引用' },
  { type: '无序列表', label: '无序列表' },
  { type: '有序列表', label: '有序列表' },
  { type: '表格', label: '表格' },
  { type: '分割线', label: '分割线' },
  { type: '代码块', label: '代码块' },
]

const modelValue = defineModel({
  type: String,
  required: true,
})

function autoResize() {
  const minHeight = props.compact ? 96 : props.fill ? 280 : 450
  if (!textarea.value)
    return
  if (props.fill) {
    textarea.value.style.height = ''
    return
  }
  textarea.value.style.height = `${minHeight}px`
  textarea.value.style.height = `${Math.max(minHeight, textarea.value.scrollHeight)}px`
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

async function upload(file: File) {
  if (file) {
    try {
      const data = await uploadPhoto(file)
      showMsg(data.message)
      // modelValue.value += `<p><img src="${data.fileURL}" alt="${file.name}" loading="lazy" /></p>`
      // 适配Markdown渲染
      modelValue.value += `![${file.name}](${data.fileURL})`
      autoResize()
    }
    catch (error) {
      console.error('Error uploading file:', error)
      showMsg('上传失败，请重试')
    }
  }
  else {
    console.error('No file selected')
    showMsg('请选择一个文件')
  }
}

async function uploadFile(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files![0]
  await upload(file)
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items)
    return
  for (let i = 0; i < items.length; ++i) {
    const item = items[i]
    if (item.kind === 'file') {
      const file = item.getAsFile()
      event.preventDefault()
      if (!file)
        return
      await upload(file)
    }
  }
}

function editContent(type: EditType) {
  let insertion = ''
  let cursorOffset = 0

  switch (type) {
    case '标题':
      insertion = '### 标题\n'
      cursorOffset = -1
      break
    case '粗体':
      insertion = '**粗体**'
      cursorOffset = -2
      break
    case '斜体':
      insertion = '*斜体*'
      cursorOffset = -1
      break
    case '删除线':
      insertion = '~~删除线~~'
      cursorOffset = -2
      break
    case '引用':
      insertion = '> 引用\n'
      cursorOffset = -1
      break
    case '无序列表':
      insertion = '- 无序列表'
      cursorOffset = 0
      break
    case '有序列表':
      insertion = '1. 有序列表'
      cursorOffset = 0
      break
    case '表格':
      insertion
				= '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n'
      cursorOffset = 0
      break
    case '分割线':
      insertion = '\n---\n'
      cursorOffset = 0
      break
    case '代码块':
      insertion = '```\n代码块\n```'
      cursorOffset = -4
      break
    default:
      return
  }

  const start = textarea.value?.selectionStart
  const end = textarea.value?.selectionEnd
  const newValue = modelValue.value.slice(0, start) + insertion + modelValue.value.slice(end)

  modelValue.value = newValue

  // 在下一个事件循环中设置光标位置
  nextTick(() => {
    textarea.value?.focus()
    textarea.value?.setSelectionRange(
      start! + insertion.length + cursorOffset,
      start! + insertion.length + cursorOffset,
    )
  })
}

onMounted(() => {
  if (props.fill)
    nextTick(autoResize)
})

watch(() => props.fill, () => {
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
      <button type="button" class="md-editor__toolbar-preview" @click="isPreview = !isPreview">
        {{ isPreview ? '编辑' : '预览' }}
      </button>
      <button type="button" class="md-editor__toolbar-image" @click="openImagePicker">
        图片
      </button>
      <input
        :id="fileInputId"
        ref="fileInput"
        type="file"
        accept="image/*"
        class="md-editor__file-input"
        @input="uploadFile"
      >
      <button
        v-if="compact"
        type="button"
        class="md-editor__toolbar-format-toggle"
        :class="{ 'md-editor__toolbar-format-toggle--open': formatExpanded }"
        :aria-expanded="formatExpanded"
        @click="formatExpanded = !formatExpanded"
      >
        {{ formatExpanded ? '收起格式' : '格式' }}
      </button>
      <div
        class="md-editor__format-group"
        :class="{ 'md-editor__format-group--collapsed': compact && !formatExpanded }"
      >
        <button
          v-for="action in formatActions"
          :key="action.type"
          type="button"
          @click="editContent(action.type)"
        >
          {{ action.label }}
        </button>
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
      />
      <MarkdownContainer
        v-show="isPreview"
        class="md-editor__preview-pane"
        :markdown-content="modelValue || ''"
      />
    </div>
    <div v-if="!fill" class="md-editor__actions">
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
      <span class="md-editor__fill-hint">支持 Markdown · 图片可粘贴</span>
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

.md-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;

  button {
    margin: 0;
    padding: 5px 10px;
    min-height: 28px;
    border-radius: 6px;
    border: 1px solid var(--chat-border);
    background: var(--chat-bg-main);
    color: var(--chat-text-secondary);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    font-family: inherit;
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: var(--chat-accent-soft);
      border-color: var(--chat-border-strong);
      color: var(--chat-accent);
    }
  }
}

.md-editor__format-group {
  display: contents;
}

.md-editor__format-group--collapsed {
  display: none !important;
}

.md-editor--compact .md-editor__format-group:not(.md-editor__format-group--collapsed) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 100%;
  width: 100%;
}

.md-editor__toolbar-format-toggle--open {
  background: var(--chat-accent-soft);
  border-color: var(--chat-accent);
  color: var(--chat-accent);
}

.md-editor__file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.md-editor__toolbar-preview,
.md-editor__toolbar-image {
  flex-shrink: 0;
}

.md-editor__body {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0;

  textarea {
    flex: 1;
    width: 100%;
    min-height: 96px;
    border: 1px solid var(--chat-border);
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--chat-bg-highlight);
    color: var(--chat-text);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

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

.md-editor--compact .md-editor__body--preview .md-editor__preview-pane {
  min-height: 88px;
}

.md-editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  flex-shrink: 0;
}

.md-editor__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  min-height: 38px;
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
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

.md-editor--fill {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;

  .md-editor__toolbar {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    button {
      flex-shrink: 0;
      min-height: 34px;
      padding: 6px 12px;
      font-size: 13px;
    }
  }

  .md-editor__format-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
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

.md-editor--compact {
  .md-editor__toolbar {
    margin-bottom: 8px;
    align-items: center;
  }

  .md-editor__body textarea {
    min-height: 88px;
    font-size: 14px;
  }
}

@mixin md-toolbar-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.28) rgba(0, 0, 0, 0.06);

  &::-webkit-scrollbar {
    height: 6px;
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

@media screen and (max-width: 768px) {
  /* 发帖页：横向滑动工具栏 */
  .md-editor--fill .md-editor__toolbar {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;
    @include md-toolbar-scrollbar;

    .md-editor__format-group {
      display: flex;
      flex-wrap: nowrap;
      flex-shrink: 0;
      gap: 8px;
    }
  }

  /* 评论区等：保持原有网格 */
  .md-editor:not(.md-editor--fill) .md-editor__toolbar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .md-editor:not(.md-editor--fill) .md-editor__toolbar-preview {
    grid-column: span 2;
  }

  .md-editor--compact .md-editor__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .md-editor__actions {
    justify-content: stretch;
  }

  .md-editor__action {
    flex: 1;
  }
}
</style>
