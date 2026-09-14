<script setup lang="ts">
import type { BootstrapMessage } from '@/api/opsagent/conversation'
import type { TimelineItem, TimelinePostDraft } from '@/composables/useOpsAgentStream'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { closeConversation, fetchConversationBootstrap } from '@/api/opsagent/conversation'
import { OpsAgentRequestError, shouldRebootstrapAfterTaskError } from '@/api/opsagent/errors'
import { showMsg } from '@/components/MessageBox'
import SmartXiaoQiuTimeline from '@/components/smart-xiaoqiu/SmartXiaoQiuTimeline.vue'
import { useOpsAgentStream } from '@/composables/useOpsAgentStream'

const draft = ref('')
const historyDiv = useTemplateRef('historyDiv')
const sessionId = ref('')
const sessionReady = ref(false)
const bootstrapError = ref('')

const {
  timeline,
  globalError,
  isStreaming,
  sendAgentMessage,
  pushUserMessage,
  seedWelcomeMessages,
  abort,
} = useOpsAgentStream()

const xiaoQiuAvatarUrl = `${import.meta.env.BASE_URL}xiaoqiu-avatar.png`
const xiaoQiuChatBgUrl = `${import.meta.env.BASE_URL}xiaoqiu-chat-bg.webp`

function scrollToBottom() {
  nextTick(() => {
    const el = historyDiv.value
    if (el)
      el.scrollTop = el.scrollHeight
  })
}

function fallbackAssistantText() {
  return '服务暂时不可用，请稍后重试。若多次失败，可检查网络或稍后再打开本页。'
}

function formatTimeShort(d: Date) {
  return d.toLocaleTimeString().slice(0, 5)
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function bootstrapMessagesToTimeline(messages: BootstrapMessage[]): TimelineItem[] {
  const now = formatTimeShort(new Date())
  const out: TimelineItem[] = []
  for (const m of messages) {
    const role = m.role
    if (role === 'user') {
      out.push({
        kind: 'user',
        id: newId('u'),
        text: m.content,
        time: now,
      })
    }
    else if (role === 'assistant') {
      out.push({
        kind: 'assistant',
        id: newId('as'),
        text: m.content,
        time: now,
        status: 'done',
      })
    }
  }
  return out
}

async function runBootstrap() {
  bootstrapError.value = ''
  sessionReady.value = false
  const data = await fetchConversationBootstrap()
  sessionId.value = data.session_id
  const msgs = data.messages ?? []
  if (msgs.length > 0)
    timeline.value = bootstrapMessagesToTimeline(msgs)
  else
    seedWelcomeMessages()
  sessionReady.value = true
}

async function startNewChat() {
  if (!sessionId.value || isStreaming.value)
    return
  try {
    await closeConversation(sessionId.value)
    await runBootstrap()
  }
  catch (e) {
    console.error(e)
    showMsg('开启新对话失败，请稍后重试。')
  }
}

async function sendMessage() {
  const content = draft.value.trim()
  if (!content || isStreaming.value || !sessionReady.value)
    return

  pushUserMessage(content)
  draft.value = ''
  scrollToBottom()

  try {
    await sendAgentMessage({
      sessionId: sessionId.value,
      task: content,
      onAfterUpdate: scrollToBottom,
    })
  }
  catch (e) {
    console.error(e)
    if (e instanceof OpsAgentRequestError && shouldRebootstrapAfterTaskError(e.businessCode, e.message)) {
      try {
        await runBootstrap()
        showMsg('会话已失效，已重新同步，请再次发送。')
      }
      catch (inner) {
        console.error(inner)
        showMsg('会话同步失败，请刷新页面后重试。')
      }
      return
    }
    showMsg('发送失败，请检查网络后重试。')
    timeline.value = [
      ...timeline.value,
      {
        kind: 'assistant',
        id: `err-${Date.now()}`,
        text: fallbackAssistantText(),
        time: new Date().toLocaleTimeString().slice(0, 5),
        status: 'done',
      },
    ]
    scrollToBottom()
  }
}

onMounted(() => {
  runBootstrap().catch((e) => {
    console.error(e)
    bootstrapError.value = e instanceof Error ? e.message : '无法连接对话服务'
    sessionReady.value = false
  })
})

function onDraftUpdate(updated: TimelinePostDraft) {
  const idx = timeline.value.findIndex(it => it.kind === 'post_draft' && it.id === updated.id)
  if (idx < 0)
    return
  const newTimeline = [...timeline.value]
  newTimeline[idx] = updated
  timeline.value = newTimeline
}
</script>

<template>
  <div class="smart-page">
    <header class="top-bar">
      <div class="brand">
        <img class="brand-avatar" :src="xiaoQiuAvatarUrl" alt="" width="40" height="40">
        <div class="brand-copy">
          <h1>小秋</h1>
          <p v-if="isStreaming" class="status live">
            正在思考与整理回复…
          </p>
          <p v-else-if="sessionReady" class="status">
            论坛助手 · 检索帖子 · 整理要点
          </p>
          <p v-else class="status pending">
            正在连接…
          </p>
        </div>
      </div>
      <button
        type="button"
        class="ghost-btn"
        :disabled="!sessionReady || isStreaming"
        @click="startNewChat"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        新对话
      </button>
    </header>

    <main
      ref="historyDiv"
      class="lite-scrollbar chat-scroll"
      :style="{ backgroundImage: `url(${xiaoQiuChatBgUrl})` }"
    >
      <div class="chat-inner">
        <SmartXiaoQiuTimeline :items="timeline" @draft-update="onDraftUpdate" />
      </div>
    </main>

    <div v-if="bootstrapError || globalError" class="alert-bar">
      {{ bootstrapError || globalError }}
    </div>

    <footer class="composer-shell">
      <div class="composer">
        <textarea
          v-model="draft"
          class="composer-input"
          rows="1"
          placeholder="问我任何与论坛相关的问题…"
          :disabled="!sessionReady"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <div class="composer-actions">
          <button
            v-if="isStreaming"
            type="button"
            class="icon-btn stop"
            title="停止生成"
            @click="abort"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            class="send-btn"
            :disabled="!sessionReady || isStreaming || !draft.trim()"
            title="发送"
            @click="sendMessage"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h12M13 7l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <p class="composer-hint">
        Enter 发送 · 帖子链接将在新标签页打开，不会中断当前对话
      </p>
    </footer>
  </div>
</template>

<style scoped>
.smart-page {
  --xq-bg: #eef3f7;
  --xq-bg-soft: linear-gradient(180deg, #f6f9fc 0%, #eef3f7 48%, #e8eef4 100%);
  --xq-surface: #ffffff;
  --xq-surface-muted: #f3f6f9;
  --xq-accent: #2aab9f;
  --xq-accent-deep: #1f8f86;
  --xq-accent-soft: rgba(42, 171, 159, 0.12);
  --xq-accent-border: rgba(42, 171, 159, 0.28);
  --xq-accent-ring: rgba(42, 171, 159, 0.1);
  --xq-user-bg: linear-gradient(135deg, #2aab9f 0%, #45c4b8 100%);
  --xq-user-text: #ffffff;
  --xq-text: #1c2530;
  --xq-text-secondary: #4a5568;
  --xq-text-muted: #8b95a5;
  --xq-border: rgba(15, 23, 42, 0.07);
  --xq-step-bg: rgba(255, 255, 255, 0.72);
  --xq-step-border: rgba(42, 171, 159, 0.14);
  --xq-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 20px rgba(15, 23, 42, 0.05);
  --xq-shadow-user: 0 4px 14px rgba(42, 171, 159, 0.28);
  --xq-bubble-max: min(100%, 520px);
  --xq-radius-lg: 20px;

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  color: var(--xq-text);
  background: var(--xq-bg-soft);
}

:global(body.dark-mode) .smart-page {
  --xq-bg: #1a1f26;
  --xq-bg-soft: linear-gradient(180deg, #1e242c 0%, #1a1f26 100%);
  --xq-surface: #252b34;
  --xq-surface-muted: #2f3640;
  --xq-accent: #4ecdc4;
  --xq-accent-deep: #7ee8df;
  --xq-accent-soft: rgba(78, 205, 196, 0.14);
  --xq-accent-border: rgba(78, 205, 196, 0.32);
  --xq-accent-ring: rgba(78, 205, 196, 0.12);
  --xq-user-bg: linear-gradient(135deg, #3a9e96 0%, #4ecdc4 100%);
  --xq-user-text: #0f1419;
  --xq-text: #e8edf3;
  --xq-text-secondary: #b8c0cc;
  --xq-text-muted: #7a8494;
  --xq-border: rgba(255, 255, 255, 0.08);
  --xq-step-bg: rgba(37, 43, 52, 0.88);
  --xq-step-border: rgba(78, 205, 196, 0.18);
  --xq-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);
  --xq-shadow-user: 0 4px 16px rgba(78, 205, 196, 0.18);
}

.smart-page button {
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
  font-family: inherit;
}

/* 顶栏 */
.top-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  background: color-mix(in srgb, var(--xq-surface) 82%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--xq-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--xq-surface);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.1);
}

.brand-copy h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--xq-text);
}

.status {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--xq-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status.live {
  color: var(--xq-accent-deep);
  font-weight: 500;
}

.status.pending {
  color: var(--xq-text-muted);
}

.ghost-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--xq-border);
  background: var(--xq-surface);
  color: var(--xq-text-secondary);
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--xq-shadow);
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.ghost-btn:hover:not(:disabled) {
  color: var(--xq-accent-deep);
  border-color: var(--xq-accent-border);
  background: var(--xq-accent-soft);
}

.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 对话区 */
.chat-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 16px 12px 8px;
  background-size: cover;
  background-position: center 22%;
  background-repeat: no-repeat;
}

.chat-inner {
  max-width: 680px;
  margin: 0 auto;
}

.lite-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.lite-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.15);
  border-radius: 999px;
}

:global(body.dark-mode) .lite-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

.alert-bar {
  flex-shrink: 0;
  margin: 0 16px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  color: #c62828;
  background: rgba(239, 83, 80, 0.1);
  border: 1px solid rgba(239, 83, 80, 0.2);
}

/* 输入区 */
.composer-shell {
  flex-shrink: 0;
  padding: 10px 16px 14px;
  background: color-mix(in srgb, var(--xq-surface) 90%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--xq-border);
}

.composer {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 8px 8px 8px 16px;
  border-radius: var(--xq-radius-lg);
  background: var(--xq-surface);
  border: 1px solid var(--xq-border);
  box-shadow: var(--xq-shadow);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.composer:focus-within {
  border-color: var(--xq-accent-border);
  box-shadow:
    0 0 0 4px var(--xq-accent-ring),
    var(--xq-shadow);
}

.composer-input {
  flex: 1;
  min-height: 24px;
  max-height: 120px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--xq-text);
  font: inherit;
  font-size: 15px;
  line-height: 1.5;
  padding: 6px 0;
}

.composer-input::placeholder {
  color: var(--xq-text-muted);
}

.composer-input:disabled {
  opacity: 0.6;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn,
.send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition:
    transform 0.12s ease,
    opacity 0.12s ease,
    background 0.15s ease;
}

.icon-btn.stop {
  background: var(--xq-surface-muted);
  color: var(--xq-text-secondary);
}

.icon-btn.stop:hover {
  background: rgba(239, 83, 80, 0.12);
  color: #ef5350;
}

.send-btn {
  background: var(--xq-accent);
  color: #fff;
  box-shadow: 0 4px 12px rgba(42, 171, 159, 0.35);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.04);
  background: var(--xq-accent-deep);
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.composer-hint {
  max-width: 680px;
  margin: 8px auto 0;
  font-size: 11px;
  color: var(--xq-text-muted);
  text-align: center;
}

@media (min-width: 768px) {
  .top-bar {
    padding-inline: 24px;
  }

  .chat-scroll {
    padding-inline: 20px;
  }

  .composer-shell {
    padding-inline: 24px;
    padding-bottom: 18px;
  }
}
</style>
