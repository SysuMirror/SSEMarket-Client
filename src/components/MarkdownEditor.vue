<!-- eslint-disable vue/html-self-closing -->
<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'

import { uploadPhoto } from '@/api/editPostAndComment/utils'

import { showMsg } from '@/components/MessageBox'
import MarkdownContainer from './MarkdownContainer.vue'

const props = withDefaults(
  defineProps<{
    /** 提交请求进行中：禁用发送并显示「发送中」 */
    submitBusy?: boolean
    /** 评论区等场景：更紧凑的工具栏与输入框 */
    compact?: boolean
    placeholder?: string
  }>(),
  {
    submitBusy: false,
    compact: false,
    placeholder: '请输入正文',
  },
)

const emit = defineEmits<{
  send: []
}>()

function emitSend() {
  if (props.submitBusy)
    return
  emit('send')
}

// const route = useRoute()

const isPreview = ref(false)
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const modelValue = defineModel({
  type: String,
  required: true,
})

function autoResize() {
  const minHeight = props.compact ? 96 : 450
  textarea.value!.style.height = `${minHeight}px`
  textarea.value!.style.height = `${Math.max(minHeight, textarea.value!.scrollHeight)}px`
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

type EditType = '标题' | '粗体' | '斜体' | '删除线' | '引用' | '无序列表' | '有序列表' | '表格' | '分割线' | '代码块'
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
</script>

<template>
  <div
    id="mdRoot"
    class="md-editor"
    :class="{ 'md-editor--compact': compact }"
  >
    <div class="md-editor__toolbar">
      <button type="button" @click="editContent('标题')">
        标题
      </button>
      <button type="button" @click="editContent('粗体')">
        粗体
      </button>
      <button type="button" @click="editContent('斜体')">
        斜体
      </button>
      <button type="button" @click="editContent('删除线')">
        删除线
      </button>
      <button type="button" @click="editContent('引用')">
        引用
      </button>
      <button type="button" @click="editContent('无序列表')">
        无序列表
      </button>
      <button type="button" @click="editContent('有序列表')">
        有序列表
      </button>
      <button type="button" @click="editContent('表格')">
        表格
      </button>
      <button type="button" @click="editContent('分割线')">
        分割线
      </button>
      <button type="button" @click="editContent('代码块')">
        代码块
      </button>
      <button type="button" class="md-editor__toolbar-preview" @click="isPreview = !isPreview">
        {{ isPreview ? '编辑' : '预览' }}
      </button>
    </div>
    <div class="md-editor__body">
      <textarea
        ref="textarea"
        :value="modelValue"
        :placeholder="placeholder"
        @input="handleInput"
        @paste="handlePaste"
      />
      <MarkdownContainer
        v-show="isPreview"
        :markdown-content="modelValue"
      />
    </div>
    <div class="md-editor__actions">
      <div
        class="md-editor__action md-editor__action--primary"
        :class="{ 'md-editor__action--busy': submitBusy }"
        role="button"
        tabindex="0"
        @click="emitSend"
        @keydown.enter="emitSend"
      >
        {{ submitBusy ? '发送中…' : '发送' }}
      </div>
      <label
        for="fileInput"
        class="md-editor__action"
      >图片</label>
      <input
        id="fileInput"
        type="file"
        accept="image/*"
        style="display: none"
        @input="uploadFile"
      >
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

.md-editor__toolbar-preview {
  margin-left: auto;
}

.md-editor__body {
  display: flex;
  flex-direction: row;
  width: 100%;
  gap: 10px;

  :deep(div) {
    flex: 1;
    min-width: 0;
    border-radius: 10px;
    padding: 10px;
    background: var(--chat-bg-highlight);
    border: 1px solid var(--chat-border);
  }

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

.md-editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.md-editor__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 34px;
  padding: 6px 16px;
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

.md-editor--compact {
  .md-editor__toolbar button:not(.md-editor__toolbar-preview) {
    display: none;
  }

  .md-editor__toolbar {
    margin-bottom: 8px;
  }

  .md-editor__body textarea {
    min-height: 88px;
    font-size: 14px;
  }
}

@media screen and (max-width: 768px) {
  .md-editor__toolbar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .md-editor__toolbar-preview {
    grid-column: span 2;
    margin-left: 0;
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
