<script setup lang="ts">
import type { ConversationSummary } from '@/api/opsagent/conversation'
import { ref } from 'vue'

const props = defineProps<{
  conversations: ConversationSummary[]
  activeId: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', sessionId: string): void
  (e: 'create'): void
  (e: 'rename', sessionId: string, title: string): void
  (e: 'remove', sessionId: string): void
  (e: 'close'): void
}>()

const editingId = ref('')
const editingTitle = ref('')
const confirmingId = ref('')
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function focusRename(el: unknown) {
  if (el)
    (el as HTMLInputElement).focus()
}

function startRename(conv: ConversationSummary) {
  editingId.value = conv.session_id
  editingTitle.value = conv.title || ''
}

function commitRename() {
  const title = editingTitle.value.trim()
  if (title && editingId.value)
    emit('rename', editingId.value, title)
  editingId.value = ''
}

function cancelRename() {
  editingId.value = ''
}

function askRemove(sessionId: string) {
  if (confirmingId.value === sessionId) {
    confirmingId.value = ''
    if (confirmTimer)
      clearTimeout(confirmTimer)
    emit('remove', sessionId)
    return
  }
  confirmingId.value = sessionId
  if (confirmTimer)
    clearTimeout(confirmTimer)
  confirmTimer = setTimeout(() => {
    confirmingId.value = ''
  }, 2600)
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay)
    return d.toLocaleTimeString().slice(0, 5)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function onItemKeydown(e: KeyboardEvent, sessionId: string) {
  if (e.isComposing)
    return
  // 回车或空格激活（role=button 的键盘等价物）
  if (e.key === 'Enter' || e.key === ' ') {
    if (editingId.value === sessionId)
      return
    e.preventDefault()
    emit('select', sessionId)
  }
}
</script>

<template>
  <aside class="conv-sidebar">
    <button type="button" class="new-chat-btn" :disabled="props.loading" @click="emit('create')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      开启新对话
    </button>

    <nav class="conv-list lite-scrollbar" aria-label="历史对话">
      <p class="list-title">
        历史对话
      </p>
      <p v-if="props.loading" class="list-empty" aria-live="polite">
        加载中…
      </p>
      <p v-else-if="props.conversations.length === 0" class="list-empty">
        还没有历史对话，发第一条消息开始吧
      </p>
      <div
        v-for="conv in props.conversations"
        :key="conv.session_id"
        class="conv-item"
        :class="{ active: conv.session_id === props.activeId }"
        role="button"
        tabindex="0"
        :aria-current="conv.session_id === props.activeId ? 'true' : undefined"
        @click="editingId !== conv.session_id && emit('select', conv.session_id)"
        @keydown="onItemKeydown($event, conv.session_id)"
      >
        <template v-if="editingId === conv.session_id">
          <input
            :ref="focusRename"
            v-model="editingTitle"
            class="rename-input"
            name="conversation-title"
            placeholder="输入会话名称…"
            maxlength="60"
            autocomplete="off"
            aria-label="会话名称"
            @click.stop
            @keydown.enter.prevent="commitRename"
            @keydown.esc.stop.prevent="cancelRename"
            @blur="commitRename"
          >
        </template>
        <template v-else>
          <span class="conv-title">{{ conv.title || '未命名对话' }}</span>
          <span class="conv-actions" @click.stop @keydown.stop>
            <button type="button" class="conv-btn" aria-label="重命名会话" title="重命名" @click="startRename(conv)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="conv-btn danger"
              :class="{ confirming: confirmingId === conv.session_id }"
              :aria-label="confirmingId === conv.session_id ? '再次点击确认删除' : '删除会话'"
              :title="confirmingId === conv.session_id ? '再次点击确认删除' : '删除'"
              @click="askRemove(conv.session_id)"
            >
              <svg v-if="confirmingId !== conv.session_id" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span v-else class="confirm-text" aria-hidden="true">确认</span>
            </button>
          </span>
          <time class="conv-time">{{ timeLabel(conv.updated_at) }}</time>
        </template>
      </div>
    </nav>

    <button type="button" class="mobile-close" @click="emit('close')">
      收起
    </button>
  </aside>
</template>

<style scoped>
.conv-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: 14px 12px;
  background: var(--xq-surface);
  border-right: 1px solid var(--xq-border);
}

.conv-sidebar button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.conv-sidebar button svg {
  flex: none;
}

.new-chat-btn svg {
  width: 15px !important;
  height: 15px !important;
}

.conv-btn svg {
  width: 13px !important;
  height: 13px !important;
}

.conv-sidebar :focus-visible {
  outline: 2px solid var(--xq-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

.new-chat-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-shrink: 0;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--xq-accent-border);
  background: var(--xq-accent-soft);
  color: var(--xq-accent-deep);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.new-chat-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--xq-accent) 20%, transparent);
}

.new-chat-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.list-title {
  margin: 4px 4px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--xq-text-muted);
}

.list-empty {
  margin: 8px 4px;
  font-size: 12.5px;
  color: var(--xq-text-muted);
}

.conv-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conv-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.conv-item:hover {
  background: var(--xq-surface-muted);
}

.conv-item:focus-visible {
  outline: 2px solid var(--xq-accent);
  outline-offset: -2px;
}

.conv-item.active {
  background: var(--xq-accent-soft);
}

.conv-item.active .conv-title {
  color: var(--xq-accent-deep);
  font-weight: 600;
}

.conv-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--xq-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-time {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--xq-text-muted);
  font-variant-numeric: tabular-nums;
}

.conv-actions {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--xq-surface);
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.14);
}

.conv-item:hover .conv-actions,
.conv-item:focus-within .conv-actions {
  display: inline-flex;
}

.conv-item:hover .conv-time,
.conv-item:focus-within .conv-time {
  visibility: hidden;
}

.conv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--xq-text-muted);
  cursor: pointer;
}

.conv-btn:hover {
  background: var(--xq-surface-muted);
  color: var(--xq-accent-deep);
}

.conv-btn.danger:hover {
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
}

.conv-btn.danger.confirming {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
}

.confirm-text {
  font-weight: 600;
  white-space: nowrap;
}

.rename-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid var(--xq-accent-border);
  border-radius: 8px;
  outline: none;
  background: var(--xq-surface);
  color: var(--xq-text);
  font: inherit;
  font-size: 13px;
}

.rename-input::placeholder {
  color: var(--xq-text-muted);
}

.mobile-close {
  display: none;
}

.lite-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.lite-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.14);
  border-radius: 999px;
}

:global(body.dark-mode) .lite-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
}

@media (max-width: 768px) {
  .mobile-close {
    display: block;
    flex-shrink: 0;
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 8px;
    background: var(--xq-surface-muted);
    color: var(--xq-text-secondary);
    font-size: 12.5px;
    cursor: pointer;
  }
}

@media (prefers-reduced-motion: reduce) {
  .conv-sidebar *,
  .conv-sidebar *::before,
  .conv-sidebar *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
