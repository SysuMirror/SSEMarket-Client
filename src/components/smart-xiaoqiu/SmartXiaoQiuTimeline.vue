<script setup lang="ts">
import type {
  TimelineAssistant,
  TimelineImage,
  TimelineItem,
  TimelinePostDraft,
  TimelineStep,
  TimelineUser,
} from '@/composables/useOpsAgentStream'
import { computed, ref, watchEffect } from 'vue'
import MarkdownContainer from '@/components/MarkdownContainer.vue'
import ImageCard from './ImageCard.vue'
import PostDraftCard from './PostDraftCard.vue'

const props = defineProps<{
  items: TimelineItem[]
  /** runId → 用户已提交的评分（1 赞 / -1 踩），用于回显按钮态 */
  ratings?: Record<string, 1 | -1>
  /** 当前流已进行的秒数，思考气泡里展示"还在等" */
  streamingElapsed?: number
}>()

const emit = defineEmits<{
  (e: 'draft-update', item: TimelinePostDraft): void
  (e: 'feedback', runId: string, rating: 1 | -1): void
  (e: 'imageAction', action: 'redo' | 'tweak', item: TimelineImage): void
}>()

const xiaoQiuAvatarUrl = `${import.meta.env.BASE_URL}xiaoqiu-avatar.png`

interface TimelineTurn {
  id: string
  user?: TimelineUser
  steps: TimelineStep[]
  assistant?: TimelineAssistant
  /** msg_id 切段的已封存中间段（"我先查一下…"）：淡色旁白行，不进主气泡 */
  asides: TimelineAssistant[]
  drafts: TimelinePostDraft[]
  images: TimelineImage[]
}

function markdownForAssistant(raw: string) {
  return raw.replace(/post:\/\/(\d+)/gi, (_, id: string) => `[帖子 #${id}](/postdetail/${id})`)
}

function stripStepLabel(label: string) {
  return label.replace(/^【|】$/g, '')
}

// 任务目标派生文案：按本轮首个工具的语义映射（后端将来发 goal 事件则覆盖）
const TOOL_GOAL: Record<string, string> = {
  sql_post_search: '检索帖子',
  sql_latest_posts: '翻最新帖子',
  sql_read: '查论坛数据',
  kb_search: '查知识库',
  web_search: '联网搜索',
  submit_feedback: '提交反馈',
  create_post: '发帖',
  create_comment: '写评论',
  toggle_like_post: '点赞',
  toggle_vote_post: '投票',
  write_code: '写代码',
  run_code: '跑代码验证',
  memory_save: '记下偏好',
  generate_image: '生成图片',
  edit_image: '改图',
}

function goalFor(turn: TimelineTurn) {
  if (!turn.steps.length)
    return ''
  const verbs = [...new Set(turn.steps.map((s) => {
    const name = stripStepLabel(s.label)
    return TOOL_GOAL[name] ?? '处理任务'
  }))]
  const head = verbs.length > 1 ? `${verbs[0]}等` : verbs[0]
  return `${head} · ${turn.steps.length} 步`
}

function turnHasLive(turn: TimelineTurn) {
  return turn.steps.some(s => s.status === 'streaming')
    || turn.assistant?.status === 'streaming'
    || turn.images.some(i => i.status === 'running' || i.status === 'progress')
}

const turns = computed(() => {
  const out: TimelineTurn[] = []
  let current: TimelineTurn | null = null

  for (const item of props.items) {
    if (item.kind === 'meta')
      continue

    if (item.kind === 'user') {
      current = { id: item.id, user: item, steps: [], asides: [], drafts: [], images: [] }
      out.push(current)
      continue
    }

    if (!current) {
      current = { id: `turn-${item.id}`, steps: [], asides: [], drafts: [], images: [] }
      out.push(current)
    }

    if (item.kind === 'step') {
      current.steps.push(item)
    }
    else if (item.kind === 'assistant') {
      // 多段（msg_id 切段）：先到的封存段降为旁白行，最后一段是主气泡
      if (current.assistant)
        current.asides.push(current.assistant)
      current.assistant = item
    }
    else if (item.kind === 'post_draft') {
      current.drafts.push(item)
    }
    else if (item.kind === 'image') {
      current.images.push(item)
    }
  }

  return out
})

const openStep = ref<Record<string, boolean>>({})

function toggleStep(id: string, collapsed: boolean) {
  openStep.value = { ...openStep.value, [id]: collapsed ? true : !openStep.value[id] }
}

function stepExpanded(id: string, collapsed: boolean) {
  if (collapsed)
    return openStep.value[id] === true
  return openStep.value[id] !== false
}

function isThinking(text: string, status: TimelineAssistant['status']) {
  return status === 'streaming' && text.trim() === ''
}

const thinkingLabel = computed(() => {
  const s = props.streamingElapsed ?? 0
  return s >= 15 ? `仍在等待回复（已等 ${s} 秒）` : '正在思考'
})

// 思考区受控折叠：默认关，展开状态按 turn 记（原 ref="reasoningRef" 在 v-for 里
// 后者覆盖前者、只滚最后一个的问题，改为 root 内 querySelector 定位最后一段）
const rootRef = ref<HTMLElement | null>(null)
const openReasoning = ref<Record<string, boolean>>({})
const openGoal = ref<Record<string, boolean>>({})

function onReasoningToggle(id: string, e: Event) {
  openReasoning.value[id] = (e.target as HTMLDetailsElement).open
}

function onGoalToggle(id: string, e: Event) {
  openGoal.value[id] = (e.target as HTMLDetailsElement).open
}

function reasoningSummary(turn: TimelineTurn) {
  const a = turn.assistant
  if (!a?.reasoning)
    return ''
  if (isThinking(a.text, a.status))
    return '思考中…点击展开'
  return `已深度思考（${a.reasoning.length} 字）`
}

const lastTurnId = computed(() => turns.value[turns.value.length - 1]?.id ?? '')

const latestReasoning = computed(() => turns.value[turns.value.length - 1]?.assistant?.reasoning ?? '')

// 推理文本流式增长时让展开中的思考区跟随到底部；flush: 'post' 保证量到更新后的高度
watchEffect(() => {
  const reasoning = latestReasoning.value
  const isOpen = openReasoning.value[lastTurnId.value] === true
  const el = rootRef.value?.querySelector<HTMLElement>('.reasoning-live[data-live]')
  if (el && reasoning && isOpen)
    el.scrollTop = el.scrollHeight
}, { flush: 'post' })

function onDraftUpdate(updated: TimelinePostDraft) {
  emit('draft-update', updated)
}

function canRate(a: TimelineAssistant | undefined): boolean {
  return !!a && a.status === 'done' && !!a.runId && !a.text.includes('该操作需要审批')
}
</script>

<template>
  <div ref="rootRef" class="timeline">
    <article
      v-for="turn in turns"
      :key="turn.id"
      class="turn"
    >
      <div v-if="turn.user" class="user-row">
        <div class="user-bubble">
          <p class="user-text">
            {{ turn.user.text }}
          </p>
        </div>
        <time class="meta-time">{{ turn.user.time }}</time>
      </div>

      <div v-if="turn.steps.length || turn.assistant || turn.images.length || turn.asides.length" class="agent-row">
        <div class="agent-avatar" aria-hidden="true">
          <img :src="xiaoQiuAvatarUrl" alt="" width="36" height="36">
        </div>

        <div class="agent-content">
          <div class="agent-head">
            <span class="agent-name">小秋</span>
            <span
              v-if="turn.assistant?.status === 'streaming' && !isThinking(turn.assistant.text, turn.assistant.status)"
              class="live-dot"
            >
              回复中
            </span>
          </div>

          <!-- 任务目标汇总条：默认隐藏，展开后是本目标下的工具调用序列 -->
          <details
            v-if="turn.steps.length"
            class="goal-box"
            :open="openGoal[turn.id] === true"
            @toggle="onGoalToggle(turn.id, $event)"
          >
            <summary class="goal-summary">
              <svg class="goal-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span class="goal-text">{{ goalFor(turn) }}</span>
              <span v-if="turnHasLive(turn)" class="goal-live">处理中</span>
            </summary>
            <div class="goal-steps">
              <div
                v-for="step in turn.steps"
                :key="step.id"
                class="step-card"
                :class="{ streaming: step.status === 'streaming', done: step.status === 'done' }"
              >
                <button
                  type="button"
                  class="step-toggle"
                  :aria-expanded="stepExpanded(step.id, step.collapsed)"
                  @click="toggleStep(step.id, step.collapsed)"
                >
                  <span class="step-icon" aria-hidden="true">
                    <svg v-if="stepExpanded(step.id, step.collapsed)" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                  </span>
                  <span class="step-label">{{ stripStepLabel(step.label) }}</span>
                  <span class="step-badge" :class="{ live: step.status === 'streaming' }">
                    {{ step.status === 'streaming' ? '处理中' : '中间步骤' }}
                  </span>
                </button>
                <div
                  v-show="stepExpanded(step.id, step.collapsed)"
                  class="step-body"
                >
                  <MarkdownContainer
                    v-if="step.text"
                    variant="chat"
                    :markdown-content="markdownForAssistant(step.text)"
                    open-links-in-new-tab
                  />
                  <span v-else class="placeholder">正在整理信息…</span>
                </div>
              </div>
            </div>
          </details>

          <!-- 中间轮封存文本：淡色旁白行（WorkBuddy 分步感；final 不再整段覆盖它） -->
          <p
            v-for="aside in turn.asides"
            :key="aside.id"
            class="aside-line"
          >
            {{ aside.text }}
          </p>

          <ImageCard
            v-for="img in turn.images"
            :key="img.id"
            :item="img"
            @redo="emit('imageAction', 'redo', $event)"
            @tweak="emit('imageAction', 'tweak', $event)"
          />

          <div
            v-if="turn.assistant"
            class="assistant-bubble"
            :class="{
              streaming: turn.assistant.status === 'streaming',
              error: turn.assistant.status === 'error',
              thinking: isThinking(turn.assistant.text, turn.assistant.status),
            }"
          >
            <!-- 思考区：流式/完成共用受控 details，默认折叠 -->
            <details
              v-if="turn.assistant.reasoning"
              class="reasoning-details"
              :open="openReasoning[turn.id] === true"
              @toggle="onReasoningToggle(turn.id, $event)"
            >
              <summary>{{ reasoningSummary(turn) }}</summary>
              <div
                class="reasoning-live"
                :data-live="turn.id === lastTurnId ? '' : undefined"
              >
                {{ turn.assistant.reasoning }}
              </div>
            </details>
            <div v-if="isThinking(turn.assistant.text, turn.assistant.status)" class="typing" role="status">
              <span class="typing-dots"><span /><span /><span /></span>
              <span class="typing-label">{{ thinkingLabel }}</span>
            </div>
            <MarkdownContainer
              v-if="turn.assistant.text"
              variant="chat"
              :markdown-content="markdownForAssistant(turn.assistant.text)"
              open-links-in-new-tab
            />
            <!-- 网页来源：地球图标外链小组，与站内帖子（postdetail）样式严格区隔 -->
            <div v-if="turn.assistant.sources?.length" class="sources-box">
              <span class="sources-head">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                  <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" stroke="currentColor" stroke-width="1.6" />
                </svg>
                网页来源
              </span>
              <a
                v-for="s in turn.assistant.sources"
                :key="s.url"
                class="sources-link"
                :href="s.url"
                target="_blank"
                rel="noopener noreferrer"
                :title="s.snippet || s.title"
              >{{ s.title }}</a>
            </div>
            <time v-if="turn.assistant.time" class="bubble-time">{{ turn.assistant.time }}</time>
          </div>

          <div v-if="canRate(turn.assistant)" class="rate-row">
            <button
              type="button"
              class="rate-btn"
              :class="{ on: props.ratings?.[turn.assistant!.runId!] === 1 }"
              :aria-pressed="props.ratings?.[turn.assistant!.runId!] === 1"
              :aria-label="props.ratings?.[turn.assistant!.runId!] === 1 ? '已标记有帮助' : '标记为有帮助'"
              title="有帮助"
              @click="emit('feedback', turn.assistant!.runId!, 1)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="rate-btn"
              :class="{ on: props.ratings?.[turn.assistant!.runId!] === -1 }"
              :aria-pressed="props.ratings?.[turn.assistant!.runId!] === -1"
              :aria-label="props.ratings?.[turn.assistant!.runId!] === -1 ? '已标记需要改进' : '标记为需要改进'"
              title="需要改进"
              @click="emit('feedback', turn.assistant!.runId!, -1)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="transform: rotate(180deg);">
                <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <PostDraftCard
            v-for="draft in turn.drafts"
            :key="draft.id"
            :item="draft"
            @update="onDraftUpdate"
          />
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 4px 0 12px;
}

.turn {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* —— 用户消息 —— */
.user-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  margin-left: auto;
  max-width: var(--xq-bubble-max);
  width: 100%;
}

.user-bubble {
  width: fit-content;
  max-width: 100%;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
  background: var(--xq-user-bg);
  color: var(--xq-user-text);
  box-shadow: var(--xq-shadow-user);
}

.user-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.meta-time,
.bubble-time {
  font-size: 11px;
  color: var(--xq-text-muted);
  font-variant-numeric: tabular-nums;
}

.meta-time {
  padding-right: 4px;
}

/* —— 助手区域：头像 + 内容列对齐 —— */
.agent-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  max-width: calc(var(--xq-bubble-max) + 46px);
}

.agent-avatar img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--xq-surface);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.agent-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 2px;
}

.agent-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--xq-text-secondary);
}

.live-dot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--xq-accent);
  font-weight: 500;
}

.live-dot::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--xq-accent);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

/* —— 任务目标汇总条：无卡片底，一行文字 + 展开箭头 —— */
.goal-box {
  width: 100%;
  max-width: var(--xq-bubble-max);
}

.goal-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  list-style: none;
  padding: 2px;
  font-size: 12px;
  color: var(--xq-text-muted);
  -webkit-user-select: none;
  user-select: none;
}

.goal-summary::-webkit-details-marker {
  display: none;
}

.goal-chev {
  flex: none;
  transition: transform 0.15s ease;
}

.goal-box[open] .goal-chev {
  transform: rotate(90deg);
}

.goal-text {
  font-weight: 500;
}

.goal-live {
  color: var(--xq-accent);
  font-weight: 500;
}

.goal-steps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

/* —— 中间步骤：WorkBuddy 式透明行，无卡片底/边框/光环 —— */
.step-card {
  width: 100%;
  max-width: var(--xq-bubble-max);
  background: transparent;
}

.step-card.streaming .step-label {
  color: var(--xq-accent);
}

.step-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 2px;
  border: none;
  background: transparent;
  color: var(--xq-text);
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.step-icon {
  flex-shrink: 0;
  display: flex;
  color: var(--xq-text-muted);
}

.step-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--xq-accent-deep);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--xq-surface-muted);
  color: var(--xq-text-muted);
  font-weight: 500;
}

.step-badge.live {
  background: var(--xq-accent-soft);
  color: var(--xq-accent-deep);
}

.step-body {
  padding: 2px 4px 10px 26px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--xq-text-secondary);
  word-break: break-word;
}

.step-body :deep(.markdown-body) {
  font-size: 13px;
  line-height: 1.55;
  color: var(--xq-text-secondary);
}

.step-body :deep(.markdown-body a) {
  color: var(--xq-accent-deep);
}

.placeholder {
  color: var(--xq-text-muted);
  font-size: 13px;
}

/* 中间轮封存旁白：无泡、淡字 */
.aside-line {
  margin: 0;
  max-width: var(--xq-bubble-max);
  font-size: 13px;
  line-height: 1.5;
  color: var(--xq-text-muted);
  padding-left: 2px;
  word-break: break-word;
  white-space: pre-wrap;
}

/* 网页来源小组 */
.sources-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--xq-border);
}

.sources-head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--xq-text-muted);
  font-weight: 600;
}

.sources-link {
  font-size: 12px;
  color: var(--xq-accent-deep);
  text-decoration: none;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sources-link:hover {
  text-decoration: underline;
}

/* —— 主回复气泡 —— */
.assistant-bubble {
  position: relative;
  width: 100%;
  max-width: var(--xq-bubble-max);
  padding: 14px 16px;
  border-radius: 4px 18px 18px 18px;
  background: var(--xq-surface);
  border: 1px solid var(--xq-border);
  box-shadow: var(--xq-shadow);
  color: var(--xq-text);
  word-break: break-word;
}

.assistant-bubble.streaming {
  border-color: var(--xq-accent-border);
}

.assistant-bubble.error {
  border-color: var(--color-error, #ef5350);
  background: color-mix(in srgb, var(--color-error, #ef5350) 6%, var(--xq-surface));
}

.assistant-bubble.thinking {
  padding: 16px 18px;
  width: fit-content;
  min-width: 72px;
}

.assistant-bubble :deep(.markdown-body) {
  font-size: 15px;
  line-height: 1.62;
  color: var(--xq-text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 长 URL/代码/表格不撑破气泡，容器内横向滚动 */
.assistant-bubble :deep(.markdown-body pre),
.assistant-bubble :deep(.markdown-body table) {
  max-width: 100%;
  overflow-x: auto;
}

.assistant-bubble :deep(.markdown-body a) {
  color: var(--xq-accent-deep);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.assistant-bubble :deep(.markdown-body pre) {
  margin: 0.6em 0;
  font-size: 12px;
  border-radius: 8px;
}

.bubble-time {
  display: block;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--xq-border);
}

/* —— 消息反馈 —— */
.rate-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 2px;
}

.rate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--xq-text-muted);
  cursor: pointer;
  opacity: 0.72;
  transition:
    color 0.12s ease,
    background 0.12s ease,
    opacity 0.12s ease;
}

.rate-row:hover .rate-btn {
  opacity: 1;
}

.rate-btn:hover {
  background: var(--xq-surface-muted);
  color: var(--xq-accent-deep);
}

.rate-btn.on {
  color: var(--xq-accent-deep);
  background: var(--xq-accent-soft);
  opacity: 1;
}

/* 打字动画 */
.typing {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 12px;
}

.typing + .reasoning-details,
.reasoning-details + .typing {
  margin-top: 8px;
}

.reasoning-details {
  margin: 0 0 8px;
}

.reasoning-details summary {
  cursor: pointer;
  font-size: 12.5px;
  color: var(--xq-text-muted);
  -webkit-user-select: none;
  user-select: none;
}

.reasoning-details .reasoning-live {
  width: 100%;
  max-height: 240px;
  margin-top: 8px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.55;
  color: var(--xq-text-muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding-right: 4px;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.typing-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--xq-accent);
  opacity: 0.35;
  animation: typing 1.2s ease-in-out infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.typing-label {
  margin-left: 3px;
  font-size: 13px;
  color: var(--xq-text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.timeline button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.timeline button svg {
  flex: none;
}

.step-icon svg {
  width: 14px !important;
  height: 14px !important;
}

.rate-btn svg {
  width: 14px !important;
  height: 14px !important;
}

.timeline :focus-visible {
  outline: 2px solid var(--xq-accent);
  outline-offset: 2px;
  border-radius: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .timeline *,
  .timeline *::before,
  .timeline *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
