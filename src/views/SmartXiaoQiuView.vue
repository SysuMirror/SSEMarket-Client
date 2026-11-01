<script setup lang="ts">
import type { BootstrapMessage, ConversationSummary } from '@/api/opsagent/conversation'
import type { Suggestion } from '@/api/opsagent/suggestions'
import type { TimelineImage, TimelineItem, TimelinePostDraft } from '@/composables/useOpsAgentStream'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  deleteConversation,
  fetchConversationBootstrap,
  fetchConversationMessages,
  fetchConversations,
  renameConversation,
} from '@/api/opsagent/conversation'
import { OpsAgentRequestError, shouldRebootstrapAfterTaskError } from '@/api/opsagent/errors'
import { fetchSuggestions, submitMessageFeedback } from '@/api/opsagent/suggestions'
import { uploadDraftImage } from '@/api/post/draft'
import { showMsg } from '@/components/MessageBox'
import BanBanner from '@/components/smart-xiaoqiu/BanBanner.vue'
import ConversationSidebar from '@/components/smart-xiaoqiu/ConversationSidebar.vue'
import MemoryDrawer from '@/components/smart-xiaoqiu/MemoryDrawer.vue'
import RpsGame from '@/components/smart-xiaoqiu/RpsGame.vue'
import SmartXiaoQiuTimeline from '@/components/smart-xiaoqiu/SmartXiaoQiuTimeline.vue'
import { useOpsAgentStream } from '@/composables/useOpsAgentStream'

const DRAFT_KEY = 'xq:draft'

const route = useRoute()
const router = useRouter()

const draft = ref('')
const historyDiv = useTemplateRef('historyDiv')
const composerInput = useTemplateRef('composerInput')
const sessionReady = ref(false)
const bootstrapError = ref('')

const conversations = ref<ConversationSummary[]>([])
const convLoading = ref(false)
// 工作模式（A5）：会话级——bootstrap/messages 响应带回初值，发送随 body.mode
// 上送，agent 自主切换经 mode 事件回填（reason=agent 时用户无感知、选择器跟随）
const currentMode = ref<'chat' | 'image'>('chat')
// 2026-11-01 用户要求：pill 改下拉列表，放发送键左侧
const modeMenuOpen = ref(false)

function pickMode(m: 'chat' | 'image') {
  currentMode.value = m
  modeMenuOpen.value = false
}

// 参考图上传（2026-11-01 用户要求）：图走站内图床 uploadPhotos 得公网 URL，
// 发送时以「参考图：<url>」行拼进消息文本——agent 拿 URL 直接 edit_image 垫图
const attachInput = useTemplateRef<HTMLInputElement>('attachInput')
const attachUrls = ref<string[]>([])
const attaching = ref(false)
const attachError = ref('')
const ATTACH_MAX = 3
const ATTACH_MAX_BYTES = 10 * 1024 * 1024 // 与 edit_image 底图 10MB 上限对齐

async function onAttachFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许重选同一文件
  if (!file)
    return
  attachError.value = ''
  if (!file.type.startsWith('image/')) {
    attachError.value = '只能上传图片文件'
    return
  }
  if (file.size > ATTACH_MAX_BYTES) {
    attachError.value = '图片超过 10MB，压缩一下再传'
    return
  }
  if (attachUrls.value.length >= ATTACH_MAX) {
    attachError.value = `最多附 ${ATTACH_MAX} 张参考图`
    return
  }
  attaching.value = true
  try {
    const url = await uploadDraftImage(file)
    if (url)
      attachUrls.value = [...attachUrls.value, url]
    else
      attachError.value = '上传失败，稍后重试'
  }
  finally {
    attaching.value = false
  }
}

function removeAttach(url: string) {
  attachUrls.value = attachUrls.value.filter(u => u !== url)
}
const sidebarOpen = ref(false)
const memoryOpen = ref(false)
const rpsOpen = ref(false)
const suggestions = ref<Suggestion[]>([])
const ratings = ref<Record<string, 1 | -1>>({})

// 贴底跟随：用户上翻时不再强制拉底，提供"回到底部"
const stickToBottom = ref(true)
const showJumpToBottom = ref(false)

// shareKey='chat'：流状态挂模块级，切路由卸载组件不丢流；切回续看正在生成的回复
// （此前实例级状态随组件销毁，切界面即"中断"，还诱发重发双跑）
const {
  timeline,
  globalError,
  isStreaming,
  streamElapsed,
  sessionId,
  sendAgentMessage,
  pushUserMessage,
  seedWelcomeMessages,
  abort,
} = useOpsAgentStream('chat')

const showSuggestions = computed(() =>
  suggestions.value.length > 0 && !isStreaming.value && timeline.value.length <= 1)

// 首 token 可能要等十几秒：秒数递增是"还在算"的活信号，让用户分得清慢和挂
const streamingStatusText = computed(() => {
  const s = streamElapsed.value
  if (s >= 30)
    return `已等待 ${s} 秒，小秋仍在处理…`
  if (s >= 8)
    return `正在思考与整理回复…（已等 ${s} 秒）`
  return '正在思考与整理回复…'
})

const xiaoQiuAvatarUrl = `${import.meta.env.BASE_URL}xiaoqiu-avatar.png`
const xiaoQiuChatBgUrl = `${import.meta.env.BASE_URL}xiaoqiu-chat-bg.webp`

function scrollToBottom(force = false) {
  if (!force && !stickToBottom.value)
    return
  nextTick(() => {
    const el = historyDiv.value
    if (el)
      el.scrollTop = el.scrollHeight
  })
}

function onChatScroll() {
  const el = historyDiv.value
  if (!el)
    return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom.value = distance < 120
  showJumpToBottom.value = distance > 400
}

function jumpToBottom() {
  const el = historyDiv.value
  if (!el)
    return
  stickToBottom.value = true
  showJumpToBottom.value = false
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

function autoResizeComposer() {
  const el = composerInput.value
  if (!el)
    return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

/** Enter 发送 / Shift+Enter 换行；中文输入法组词阶段的 Enter 不发送 */
function onComposerKeydown(e: KeyboardEvent) {
  if (e.isComposing)
    return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void sendMessage()
  }
}

function formatTimeShort(d: Date) {
  return d.toLocaleTimeString().slice(0, 5)
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function newSessionId() {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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
      // 后端 checkpoint 重建的工具步骤/生图卡（2026-11-01：重进会话不再丢调用历史）
      for (const s of m.steps ?? []) {
        out.push({
          kind: 'step',
          id: newId('step'),
          label: s.label,
          text: s.text,
          time: now,
          status: 'done',
          collapsed: true,
        })
      }
      for (const im of m.images ?? []) {
        out.push({
          kind: 'image',
          id: im.id || newId('img'),
          status: im.status,
          percent: im.status === 'done' ? 100 : 0,
          stage: '',
          url: im.url || undefined,
          seed: im.seed ?? undefined,
          error: im.error,
          time: now,
        })
      }
      if (m.content) {
        out.push({
          kind: 'assistant',
          id: newId('as'),
          text: m.content,
          time: now,
          status: 'done',
        })
      }
    }
  }
  return out
}

async function refreshConversations() {
  convLoading.value = true
  try {
    conversations.value = await fetchConversations(50)
  }
  catch (e) {
    console.error(e)
  }
  finally {
    convLoading.value = false
  }
}

async function loadSuggestions() {
  try {
    suggestions.value = (await fetchSuggestions()).slice(0, 4)
  }
  catch {
    suggestions.value = []
  }
}

/** initialId：深链/恢复指定会话；不传则服务端恢复最近会话 */
async function runBootstrap(initialId?: string) {
  bootstrapError.value = ''
  sessionReady.value = false
  try {
    let data
    if (initialId) {
      try {
        data = await fetchConversationBootstrap(initialId)
      }
      catch (e) {
        // 深链指向已删除/已结束的会话：回落到"恢复最近会话"
        if (e instanceof OpsAgentRequestError && (e.httpStatus === 410 || e.httpStatus === 404))
          data = await fetchConversationBootstrap()
        else
          throw e
      }
    }
    else {
      data = await fetchConversationBootstrap()
    }
    sessionId.value = data.session_id
    currentMode.value = data.mode === 'image' ? 'image' : 'chat'
    const msgs = data.messages ?? []
    if (msgs.length > 0)
      timeline.value = bootstrapMessagesToTimeline(msgs)
    else
      timeline.value = []
    if (timeline.value.length === 0)
      seedWelcomeMessages()
    sessionReady.value = true
    void loadSuggestions()
  }
  finally {
    stickToBottom.value = true
    scrollToBottom(true)
  }
}

async function startNewChat() {
  if (isStreaming.value) {
    showMsg('小秋正在回复，请先停止或等待完成。')
    return
  }
  try {
    const freshId = newSessionId()
    const data = await fetchConversationBootstrap(freshId)
    sessionId.value = freshId
    currentMode.value = data.mode === 'image' ? 'image' : 'chat'
    timeline.value = []
    ratings.value = {}
    seedWelcomeMessages()
    void loadSuggestions()
    sidebarOpen.value = false
    void refreshConversations()
    scrollToBottom(true)
  }
  catch (e) {
    console.error(e)
    showMsg('开启新对话失败，请稍后重试。')
  }
}

async function switchTo(id: string) {
  if (id === sessionId.value) {
    sidebarOpen.value = false
    return
  }
  if (isStreaming.value) {
    showMsg('小秋正在回复，请先停止或等待完成。')
    return
  }
  try {
    const data = await fetchConversationMessages(id)
    sessionId.value = data.session_id
    currentMode.value = data.mode === 'image' ? 'image' : 'chat'
    ratings.value = {}
    const msgs = data.messages ?? []
    timeline.value = msgs.length > 0 ? bootstrapMessagesToTimeline(msgs) : []
    if (msgs.length === 0)
      seedWelcomeMessages()
    suggestions.value = []
    sidebarOpen.value = false
    scrollToBottom(true)
  }
  catch (e) {
    console.error(e)
    showMsg('加载历史对话失败。')
  }
}

async function onRename(id: string, title: string) {
  try {
    await renameConversation(id, title)
    conversations.value = conversations.value.map(c =>
      c.session_id === id ? { ...c, title } : c)
  }
  catch (e) {
    console.error(e)
    showMsg('重命名失败，请稍后重试。')
  }
}

async function onRemove(id: string) {
  try {
    await deleteConversation(id)
    conversations.value = conversations.value.filter(c => c.session_id !== id)
    if (id === sessionId.value) {
      showMsg('当前会话已删除，已为你开启新对话。')
      await startNewChat()
    }
  }
  catch (e) {
    console.error(e)
    showMsg('删除失败，请稍后重试。')
  }
}

async function onFeedback(runId: string, rating: 1 | -1) {
  if (ratings.value[runId] === rating)
    return
  try {
    await submitMessageFeedback(runId, sessionId.value, rating)
    ratings.value = { ...ratings.value, [runId]: rating }
    showMsg(rating === 1 ? '感谢反馈，对小秋是鼓励。' : '收到，我们会改进小秋的回答质量。')
  }
  catch (e) {
    console.error(e)
    showMsg('反馈提交失败，请稍后重试。')
  }
}

/**
 * 生图卡按钮（B2）：redo=预填原提示词直接发送（不传 seed=随机新图）；
 *  tweak=预填底图 URL 的一句话，聚焦等用户补要改什么。
 */
function onImageAction(action: 'redo' | 'tweak', item: TimelineImage) {
  if (action === 'redo') {
    draft.value = item.prompt
      ? `再画一张：${item.prompt}`
      : '再画一张上面那个感觉的图'
    void sendMessage()
    return
  }
  const base = item.url ? `以这张为底图（${item.url}）继续调整：` : '继续调整刚才那张图：'
  draft.value = item.prompt ? `${base}保持「${item.prompt.slice(0, 60)}」的整体感觉，我要改成` : `${base}我要改成`
  nextTick(() => {
    const el = composerInput.value
    if (el) {
      el.focus()
      el.selectionStart = el.value.length
      autoResizeComposer()
    }
  })
}

function onSuggestion(s: Suggestion) {
  if (isStreaming.value || !sessionReady.value)
    return
  draft.value = s.text
  void sendMessage()
}

function schedulePostSendRefresh() {
  void refreshConversations()
  setTimeout(() => {
    void refreshConversations()
  }, 8000)
}

async function sendMessage() {
  const text = draft.value.trim()
  const urls = attachUrls.value
  if (isStreaming.value || !sessionReady.value || attaching.value)
    return
  if (!text && !urls.length)
    return
  // 参考图行拼进消息：agent 按提示词纪律识别「参考图：<url>」并 edit_image 垫图
  const content = text + urls.map(u => `\n参考图：${u}`).join('')

  pushUserMessage(content)
  draft.value = ''
  attachUrls.value = []
  suggestions.value = []
  scrollToBottom(true)

  try {
    await sendAgentMessage({
      sessionId: sessionId.value,
      task: content,
      mode: currentMode.value,
      // agent 自主切换（hidden switch_mode）→ pill 跟随，用户无感知动作可见化
      onMode: (m) => { currentMode.value = m === 'image' ? 'image' : 'chat' },
      onAfterUpdate: () => scrollToBottom(),
    })
    schedulePostSendRefresh()
  }
  catch (e) {
    console.error(e)
    if (e instanceof OpsAgentRequestError && e.httpStatus === 410) {
      showMsg('该会话已结束，已为你开启新对话，请重新发送。')
      await startNewChat()
      return
    }
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
    scrollToBottom()
  }
  finally {
    autoResizeComposer()
  }
}

// URL 深链：会话选择写入 ?c=<session_id>，刷新/分享可恢复
watch(sessionId, (id) => {
  if (id && route.query.c !== id)
    router.replace({ query: { ...route.query, c: id } })
})

// 草稿持久化：误触返回/刷新不丢输入
watch(draft, (v) => {
  try {
    if (v)
      sessionStorage.setItem(DRAFT_KEY, v)
    else
      sessionStorage.removeItem(DRAFT_KEY)
  }
  catch {
    /* 存储不可用时静默 */
  }
})

// 移动端会话抽屉打开时锁页面滚动 + ESC 关闭
watch(sidebarOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && sidebarOpen.value) {
    sidebarOpen.value = false
    e.stopPropagation()
  }
}

onMounted(() => {
  const restored = sessionStorage.getItem(DRAFT_KEY)
  if (restored)
    draft.value = restored
  // 切路由回来且共享流还在跑：直接续看，不重新 bootstrap（防覆盖正在生成的回复）
  if (isStreaming.value) {
    sessionReady.value = true
    stickToBottom.value = true
    scrollToBottom(true)
    return
  }
  const deepLinkId = typeof route.query.c === 'string' ? route.query.c : ''
  // 无深链时按共享 sessionId 恢复原会话（切走前正在看的那个），而非"最近会话"
  runBootstrap(deepLinkId || sessionId.value || undefined).catch((e) => {
    console.error(e)
    bootstrapError.value = e instanceof Error ? e.message : '无法连接对话服务'
    sessionReady.value = false
  })
  void refreshConversations()
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  document.body.style.overflow = ''
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
    <div class="page-shell">
      <aside class="side-desktop">
        <ConversationSidebar
          :conversations="conversations"
          :active-id="sessionId"
          :loading="convLoading"
          @select="switchTo"
          @create="startNewChat"
          @rename="onRename"
          @remove="onRemove"
        />
      </aside>

      <Teleport to="body">
        <div v-if="sidebarOpen" class="side-mobile-mask xq-teleport" @click="sidebarOpen = false">
          <div class="side-mobile-panel" role="dialog" aria-label="历史对话" @click.stop>
            <ConversationSidebar
              :conversations="conversations"
              :active-id="sessionId"
              :loading="convLoading"
              @select="switchTo"
              @create="startNewChat"
              @rename="onRename"
              @remove="onRemove"
              @close="sidebarOpen = false"
            />
          </div>
        </div>
      </Teleport>

      <div class="chat-column">
        <header class="top-bar">
          <div class="brand">
            <button
              type="button"
              class="icon-menu"
              aria-label="打开历史对话"
              :aria-expanded="sidebarOpen"
              @click="sidebarOpen = true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
            <img class="brand-avatar" :src="xiaoQiuAvatarUrl" alt="小秋头像" width="40" height="40">
            <div class="brand-copy">
              <h1>小秋</h1>
              <p v-if="isStreaming" class="status live" aria-live="polite">
                {{ streamingStatusText }}
              </p>
              <p v-else-if="sessionReady" class="status">
                论坛助手 · 检索帖子 · 整理要点
              </p>
              <p v-else class="status pending">
                正在连接…
              </p>
            </div>
          </div>
          <div class="top-actions">
            <button type="button" class="ghost-btn" aria-label="查看小秋记住的记忆" @click="memoryOpen = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M9.5 13.5c.8-1.4 4.2-1.4 5 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span class="btn-text">记忆</span>
            </button>
            <button type="button" class="ghost-btn" aria-label="玩剪刀石头布，输了封号五分钟" @click="rpsOpen = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="2.6" stroke="currentColor" stroke-width="2" />
                <circle cx="6" cy="18" r="2.6" stroke="currentColor" stroke-width="2" />
                <path d="M8.2 7.6 19.5 17.6M8.2 16.4 19.5 6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span class="btn-text">猜拳</span>
            </button>
            <button
              type="button"
              class="ghost-btn"
              aria-label="开启新对话"
              :disabled="!sessionReady || isStreaming"
              @click="startNewChat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span class="btn-text">新对话</span>
            </button>
          </div>
        </header>

        <div class="chat-wrap">
          <main
            ref="historyDiv"
            class="lite-scrollbar chat-scroll"
            :style="{ backgroundImage: `url(${xiaoQiuChatBgUrl})` }"
            @scroll.passive="onChatScroll"
          >
            <div class="chat-inner">
              <SmartXiaoQiuTimeline
                :items="timeline"
                :ratings="ratings"
                :streaming-elapsed="streamElapsed"
                @draft-update="onDraftUpdate"
                @feedback="onFeedback"
                @image-action="onImageAction"
              />
            </div>
          </main>

          <button
            v-if="showJumpToBottom"
            type="button"
            class="jump-bottom"
            aria-label="回到底部"
            @click="jumpToBottom"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <div v-if="bootstrapError || globalError" class="alert-bar" role="alert">
          {{ bootstrapError || globalError }}
        </div>

        <div v-if="showSuggestions" class="lite-scrollbar sug-row" aria-label="你可以试试">
          <button
            v-for="s in suggestions"
            :key="s.text"
            type="button"
            class="sug-chip"
            @click="onSuggestion(s)"
          >
            {{ s.text }}
          </button>
        </div>

        <footer class="composer-shell">
          <input ref="attachInput" type="file" accept="image/*" class="attach-file" aria-hidden="true" @change="onAttachFile">
          <div v-if="attachUrls.length || attachError" class="attach-row">
            <div v-for="u in attachUrls" :key="u" class="attach-chip">
              <img :src="u" alt="参考图缩略图">
              <button type="button" class="attach-del" aria-label="移除该参考图" @click="removeAttach(u)">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <span v-if="attaching" class="attach-pending">上传中…</span>
            <span v-if="attachError" class="attach-error" role="alert">{{ attachError }}</span>
          </div>
          <div class="composer">
            <textarea
              ref="composerInput"
              v-model="draft"
              class="composer-input"
              name="message"
              rows="1"
              :placeholder="currentMode === 'image' ? '描述你想画的图：主体、风格、构图、光线…' : '问我任何与论坛相关的问题…'"
              autocomplete="off"
              :disabled="!sessionReady"
              aria-label="向小秋提问"
              @keydown="onComposerKeydown"
              @input="autoResizeComposer"
            />
            <div class="composer-actions">
              <div class="mode-select">
                <button
                  type="button"
                  class="mode-select-btn"
                  :aria-expanded="modeMenuOpen"
                  aria-haspopup="listbox"
                  aria-label="小秋工作模式"
                  :title="currentMode === 'image' ? '生图模式' : '对话模式'"
                  @click="modeMenuOpen = !modeMenuOpen"
                >
                  <svg v-if="currentMode === 'image'" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8" />
                    <circle cx="9" cy="10" r="1.6" fill="currentColor" />
                    <path d="m5 18 5-5 3 3 3-3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                  </svg>
                  <span class="mode-select-label">{{ currentMode === 'image' ? '生图' : '对话' }}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <div v-if="modeMenuOpen" class="mode-menu-backdrop" @click="modeMenuOpen = false" />
                <ul v-if="modeMenuOpen" class="mode-menu" role="listbox" aria-label="选择工作模式">
                  <li>
                    <button type="button" role="option" :aria-selected="currentMode === 'chat'" :class="{ on: currentMode === 'chat' }" @click="pickMode('chat')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                      </svg>
                      对话
                      <svg v-if="currentMode === 'chat'" class="mode-check" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </li>
                  <li>
                    <button type="button" role="option" :aria-selected="currentMode === 'image'" :class="{ on: currentMode === 'image' }" @click="pickMode('image')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8" />
                        <circle cx="9" cy="10" r="1.6" fill="currentColor" />
                        <path d="m5 18 5-5 3 3 3-3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      生图
                      <svg v-if="currentMode === 'image'" class="mode-check" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                class="icon-btn"
                :class="{ 'attach-busy': attaching }"
                :disabled="attaching || isStreaming || !sessionReady"
                aria-label="上传参考图"
                title="上传参考图（改图/垫图用）"
                @click="attachInput?.click()"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 12.5 12.4 20a5 5 0 0 1-7-7l7.5-7.6a3.3 3.3 0 0 1 4.7 4.7L10 17a1.7 1.7 0 0 1-2.4-2.3l6.9-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button
                v-if="isStreaming"
                type="button"
                class="icon-btn stop"
                aria-label="停止生成"
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
                aria-label="发送"
                title="发送"
                :disabled="!sessionReady || isStreaming || attaching || (!draft.trim() && !attachUrls.length)"
                @click="sendMessage"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h12M13 7l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <p class="composer-hint">
            Enter 发送 · Shift+Enter 换行 · 帖子链接在新标签页打开
          </p>
        </footer>
      </div>
    </div>

    <MemoryDrawer v-if="memoryOpen" @close="memoryOpen = false" />
    <RpsGame v-if="rpsOpen" @close="rpsOpen = false" />
    <BanBanner />
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
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* 图标装甲：站点全局样式环境下 svg 曾被压缩到 4px 宽（来源不明的规则），
   我方图标一律内联级 !important 锁死尺寸，flex: none 防挤压 */
.smart-page button svg,
.smart-page .jump-bottom svg {
  flex: none;
}

.icon-menu svg {
  width: 18px !important;
  height: 18px !important;
}

.top-actions .ghost-btn svg {
  width: 15px !important;
  height: 15px !important;
}

.ghost-btn:last-child svg {
  width: 16px !important;
  height: 16px !important;
}

.icon-btn svg,
.send-btn svg {
  width: 18px !important;
  height: 18px !important;
}

.jump-bottom svg {
  width: 16px !important;
  height: 16px !important;
}

.smart-page :deep(button:focus-visible),
.smart-page :focus-visible,
.smart-page :deep(input:focus-visible),
.smart-page :deep(textarea:focus-visible) {
  outline: 2px solid var(--xq-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

.page-shell {
  display: flex;
  flex: 1;
  min-height: 0;
}

.side-desktop {
  display: none;
  flex-shrink: 0;
  width: 248px;
}

.chat-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.side-mobile-mask {
  position: fixed;
  inset: 0;
  z-index: 2600; /* 高于站点 MobileHeader(2100)/BottomNavbar(2000) */
  display: flex;
  background: rgba(15, 23, 42, 0.5);
}

.side-mobile-panel {
  width: min(280px, 82vw);
  height: 100%;
}

.icon-menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 2px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--xq-text-secondary);
  cursor: pointer;
}

.icon-menu:hover {
  background: var(--xq-surface-muted);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.brand-copy {
  min-width: 0;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status.live::before {
  content: '';
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--xq-accent-deep);
  animation: xq-status-pulse 1.2s ease-in-out infinite;
}

@keyframes xq-status-pulse {
  0%,
  100% {
    opacity: 0.3;
  }

  50% {
    opacity: 1;
  }
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
.chat-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.chat-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 16px 12px 8px;
  background-size: cover;
  background-position: center 22%;
  background-repeat: no-repeat;
  scrollbar-gutter: stable;
}

.chat-inner {
  max-width: 680px;
  margin: 0 auto;
}

.jump-bottom {
  position: absolute;
  right: 18px;
  bottom: 14px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--xq-border);
  background: var(--xq-surface);
  color: var(--xq-text-secondary);
  cursor: pointer;
  box-shadow: var(--xq-shadow);
}

.jump-bottom:hover {
  color: var(--xq-accent-deep);
  border-color: var(--xq-accent-border);
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

/* 开场建议 */
.sug-row {
  flex-shrink: 0;
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  max-width: 712px;
  width: 100%;
  margin: 0 auto;
  padding: 8px 16px 4px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
}

.sug-row::-webkit-scrollbar {
  display: none;
}

.sug-chip {
  flex: 0 0 auto;
  max-width: 72vw;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid var(--xq-accent-border);
  background: color-mix(in srgb, var(--xq-surface) 88%, transparent);
  color: var(--xq-text-secondary);
  font-size: 12.5px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  scroll-snap-align: start;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.sug-chip:hover {
  color: var(--xq-accent-deep);
  background: var(--xq-accent-soft);
}

/* 输入区 */
.composer-shell {
  flex-shrink: 0;
  padding: 10px 16px 14px;
  background: color-mix(in srgb, var(--xq-surface) 90%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--xq-border);
}

/* 模式下拉（A5→2026-11-01 用户改）：发送键左侧；agent 切换/服务端回声靠 mode 事件
   驱动 currentMode，下拉标签跟随。菜单必须实底高对比——皮肤页浮层透明会看不清 */
.mode-select {
  position: relative;
}

.mode-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--xq-border);
  border-radius: 10px;
  background: var(--xq-surface-muted, #f1f5f9);
  color: var(--xq-text-secondary, #475569);
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.mode-select-btn:hover {
  border-color: var(--xq-accent);
  color: var(--xq-accent-deep);
}

.mode-select-label {
  font-weight: 500;
}

.mode-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.mode-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 41;
  min-width: 116px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--xq-surface, #fff);
  border: 1px solid var(--xq-border);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgb(15 23 42 / 18%);
}

.mode-menu button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--xq-text, #0f172a);
  font-size: 13.5px;
  cursor: pointer;
  text-align: left;
}

.mode-menu button:hover {
  background: var(--xq-surface-muted, #f1f5f9);
}

.mode-menu button.on {
  color: var(--xq-accent-deep);
  font-weight: 600;
}

.mode-check {
  margin-left: auto;
  flex: none;
}

/* 参考图上传：隐藏 input + 缩略芯片行（宽度对齐 680 输入列） */
.attach-file {
  display: none;
}

.attach-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: min(100%, 680px);
  margin: 0 auto;
  padding: 10px 4px 0;
}

.attach-chip {
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--xq-border);
  background: var(--xq-surface-muted, #f1f5f9);
}

.attach-chip img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attach-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgb(15 23 42 / 65%);
  color: #fff;
  font-size: 14px;
  line-height: 17px;
  cursor: pointer;
}

.attach-pending {
  font-size: 12px;
  color: var(--xq-text-muted);
}

.attach-error {
  font-size: 12px;
  color: var(--color-error, #ef5350);
}

.attach-busy {
  opacity: 0.55;
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
  min-width: 0;
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

@media (min-width: 769px) {
  .side-desktop {
    display: block;
  }

  .side-mobile-mask {
    display: none;
  }

  .icon-menu {
    display: none;
  }

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

@media (max-width: 768px) {
  .btn-text {
    display: none;
  }

  .ghost-btn {
    padding: 8px 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .smart-page *,
  .smart-page *::before,
  .smart-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .jump-bottom {
    scroll-behavior: auto;
  }
}
</style>
