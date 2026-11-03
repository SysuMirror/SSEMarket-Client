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
  (e: 'draftUpdate', item: TimelinePostDraft): void
  (e: 'feedback', runId: string, rating: 1 | -1): void
  (e: 'imageAction', action: 'redo' | 'tweak', item: TimelineImage): void
}>()

const xiaoQiuAvatarUrl = `${import.meta.env.BASE_URL}xiaoqiu-avatar.png`

/**
 * 时间序过程流（2026-11-01 用户改判 WorkBuddy 式）：步骤/旁白/生图卡/草稿按**到达顺序**
 * 交错渲染、来一条渲一条，不再"工具聚一桶、思考吊桶后"。pending=还没被后段顶掉的
 * assistant 段，回合收尾时：除最后一段（升格主气泡）外全部降为旁白行。
 */
type FlowSeg =
  | { t: 'step'; id: string; step: TimelineStep }
  | { t: 'image'; id: string; image: TimelineImage }
  | { t: 'draft'; id: string; draft: TimelinePostDraft }
  | { t: 'aside'; id: string; aside: TimelineAssistant }
  | { t: 'pending'; id: string; asst: TimelineAssistant }

interface TimelineTurn {
  id: string
  user?: TimelineUser
  flow: FlowSeg[]
  assistant?: TimelineAssistant
}

// 裸图链兜底渲染（2026-11-01 用户截图：手机端满屏 image.ssemarket.cn 长链接，丑且"看不到图"）：
// 模型偶尔把生图 URL 当正文贴出来——凡未被 `](` 包裹的图床直链，一律转成 markdown 图就地显示。
// 不用 lookbehind（老 Safari 兼容）：用"前一个字符不是 ( [ 或单词字符"排除已在链接语法里的。
const BARE_IMG_RE = /(^|[^[\w(])(https?:\/\/image\.ssemarket\.cn\/[^\s<>()[\]（）【】]+?\.(?:png|jpe?g|webp|gif))/gi

function markdownForAssistant(raw: string) {
  return raw
    .replace(/post:\/\/(\d+)/gi, (_, id: string) => `[帖子 #${id}](/postdetail/${id})`)
    .replace(BARE_IMG_RE, (_, pre: string, url: string) => `${pre}![生成图片](${url})`)
}

function stripStepLabel(label: string) {
  return label.replace(/^【|】$/g, '')
}

const turns = computed(() => {
  const out: TimelineTurn[] = []
  let current: TimelineTurn | null = null

  for (const item of props.items) {
    if (item.kind === 'meta')
      continue

    if (item.kind === 'user') {
      current = { id: item.id, user: item, flow: [] }
      out.push(current)
      continue
    }

    if (!current) {
      current = { id: `turn-${item.id}`, flow: [] }
      out.push(current)
    }

    if (item.kind === 'step')
      current.flow.push({ t: 'step', id: item.id, step: item })
    else if (item.kind === 'image')
      current.flow.push({ t: 'image', id: item.id, image: item })
    else if (item.kind === 'post_draft')
      current.flow.push({ t: 'draft', id: item.id, draft: item })
    else
      current.flow.push({ t: 'pending', id: item.id, asst: item })
  }

  for (const turn of out) {
    let lastPending = -1
    for (let i = 0; i < turn.flow.length; i++) {
      if (turn.flow[i].t === 'pending')
        lastPending = i
    }
    // 只有 pending 位于 flow **末尾**才升格主气泡（模板里主气泡渲在 flow 之后）。
    // 生图/工具占位把后续卡片顶到它下面时，它已不是"当前正在说的话"——
    // 留在时间原位降为旁白，否则思考会被吊到 image 占位卡下面（2026-11-01 用户截图）。
    if (lastPending >= 0 && lastPending === turn.flow.length - 1) {
      const seg = turn.flow[lastPending]
      if (seg.t === 'pending') {
        turn.assistant = seg.asst
        turn.flow.splice(lastPending, 1)
      }
    }
    for (let i = 0; i < turn.flow.length; i++) {
      const seg = turn.flow[i]
      if (seg.t === 'pending')
        turn.flow[i] = { t: 'aside', id: seg.id, aside: seg.asst }
    }
  }

  return out
})

const openStep = ref<Record<string, boolean>>({})

function toggleStep(id: string, collapsed: boolean) {
  // 以"当前生效展开态"取反——旧写法 collapsed=false 首次点击写 !undefined=true，
  // 永远收不回（2026-11-01 用户实测 bug）
  openStep.value = { ...openStep.value, [id]: !stepExpanded(id, collapsed) }
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

// 思考区/目标条受控折叠：**不用原生 details**——流式高频 patch 会把用户点开状态
// 按 vnode 的 open=false 拉回（2026-11-01 用户实测"thinking 展不开/直接铺在背景"），
// 改 button + v-show，状态源唯一
const rootRef = ref<HTMLElement | null>(null)
const openReasoning = ref<Record<string, boolean>>({})

function toggleReasoning(id: string) {
  openReasoning.value = { ...openReasoning.value, [id]: !(openReasoning.value[id] === true) }
}

function reasoningSummary(a?: TimelineAssistant) {
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
  emit('draftUpdate', updated)
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

      <div v-if="turn.flow.length || turn.assistant" class="agent-row">
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

          <!-- 时间序过程流（WorkBuddy 式，2026-11-01 用户改判）：思考旁白→就地渲染、
               工具行→就地渲染、生图卡/草稿→就地渲染，按到达顺序往下走；
               步骤默认一行收起，点开看详情 -->
          <template v-for="seg in turn.flow" :key="seg.id">
            <div
              v-if="seg.t === 'step'"
              class="step-card"
              :class="{ streaming: seg.step.status === 'streaming', done: seg.step.status === 'done' }"
            >
              <button
                type="button"
                class="step-toggle"
                :aria-expanded="stepExpanded(seg.step.id, seg.step.collapsed)"
                @click="toggleStep(seg.step.id, seg.step.collapsed)"
              >
                <span class="step-icon" aria-hidden="true">
                  <svg v-if="stepExpanded(seg.step.id, seg.step.collapsed)" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </span>
                <span class="step-label">{{ stripStepLabel(seg.step.label) }}</span>
                <span class="step-badge" :class="{ live: seg.step.status === 'streaming' }">
                  {{ seg.step.status === 'streaming' ? '处理中' : '中间步骤' }}
                </span>
              </button>
              <div
                v-show="stepExpanded(seg.step.id, seg.step.collapsed)"
                class="step-body"
              >
                <MarkdownContainer
                  v-if="seg.step.text"
                  variant="chat"
                  :markdown-content="markdownForAssistant(seg.step.text)"
                  open-links-in-new-tab
                />
                <span v-else class="placeholder">正在整理信息…</span>
              </div>
            </div>
            <div
              v-else-if="seg.t === 'aside'"
              class="aside-block"
            >
              <!-- 被封存的中间思考段：在原时间位置渲染折叠卡（2026-11-01 用户实拍：
                   思考被工具卡反超/变隐形空行——旁白只剩淡字行是错的，thinking 必须可见可展开） -->
              <div v-if="seg.aside.reasoning" class="reasoning-box">
                <button
                  type="button"
                  class="reasoning-head"
                  :aria-expanded="openReasoning[seg.id] === true"
                  @click="toggleReasoning(seg.id)"
                >
                  <svg class="reasoning-chev" :class="{ 'is-open': openReasoning[seg.id] === true }" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  {{ reasoningSummary(seg.aside) }}
                </button>
                <div v-show="openReasoning[seg.id] === true" class="reasoning-live">
                  {{ seg.aside.reasoning }}
                </div>
              </div>
              <p v-if="seg.aside.text.trim()" class="aside-line">
                {{ seg.aside.text }}
              </p>
              <div v-if="seg.aside.sources?.length" class="sources-box">
                <span class="sources-head">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                    <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" stroke="currentColor" stroke-width="1.6" />
                  </svg>
                  网页来源
                </span>
                <a
                  v-for="s in seg.aside.sources"
                  :key="s.url"
                  class="sources-link"
                  :href="s.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="s.snippet || s.title"
                >{{ s.title }}</a>
              </div>
            </div>
            <ImageCard
              v-else-if="seg.t === 'image'"
              :item="seg.image"
              @redo="emit('imageAction', 'redo', $event)"
              @tweak="emit('imageAction', 'tweak', $event)"
            />
            <PostDraftCard
              v-else-if="seg.t === 'draft'"
              :item="seg.draft"
              @update="onDraftUpdate"
            />
          </template>

          <div
            v-if="turn.assistant"
            class="assistant-bubble"
            :class="{ error: turn.assistant.status === 'error' }"
          >
            <!-- 思考区：受控 button+v-show（原生 details 在流式 patch 下会被拉回） -->
            <div v-if="turn.assistant.reasoning" class="reasoning-box">
              <button
                type="button"
                class="reasoning-head"
                :aria-expanded="openReasoning[turn.id] === true"
                @click="toggleReasoning(turn.id)"
              >
                <svg class="reasoning-chev" :class="{ 'is-open': openReasoning[turn.id] === true }" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                {{ reasoningSummary(turn.assistant) }}
              </button>
              <div
                v-show="openReasoning[turn.id] === true"
                class="reasoning-live"
                :data-live="turn.id === lastTurnId ? '' : undefined"
              >
                {{ turn.assistant.reasoning }}
              </div>
            </div>
            <!-- 首 token 等待动画：星芒+流光字，透明无卡（2026-11-01 重设计） -->
            <div v-if="isThinking(turn.assistant.text, turn.assistant.status)" class="thinking-line" role="status">
              <svg class="thinking-spark" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5l1.9 6q.3.95 1.25 1.25l6 1.9-6 1.9q-.95.3-1.25 1.25l-1.9 6-1.9-6q-.3-.95-1.25-1.25l-6-1.9 6-1.9q.95-.3 1.25-1.25Z" />
              </svg>
              <span class="thinking-shimmer">{{ thinkingLabel }}</span>
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

/* —— 过程流步骤行：WorkBuddy 式透明行，无卡片底/边框/光环 —— */
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
  justify-content: flex-start;
  /* ↑站级 main.css 给所有 button 塞了 justify-content:center，行内折叠钮必须显式左对齐 */
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
  overflow-wrap: anywhere; /* 工具入参里的裸长链不撑破手机屏 */
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

/* 中间轮封存旁白块：思考折叠卡 + 淡字行 + 来源组，纵向紧凑组合 */
.aside-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: var(--xq-bubble-max);
}

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

/* —— 主回复区：正文透明直出（2026-11-01 用户要求：与步骤行一致，去白卡）。
   error 态保留淡红底是功能性标识，不算装饰卡 */
.assistant-bubble {
  position: relative;
  width: 100%;
  max-width: var(--xq-bubble-max);
  color: var(--xq-text);
  word-break: break-word;
}

.assistant-bubble.error {
  padding: 12px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-error, #ef5350) 7%, transparent);
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
  margin-top: 8px;
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

/* —— 思考区：引用条样式（透明底时代的层级区分，2026-11-01）—— */
.reasoning-box {
  margin: 0 0 8px;
}

.reasoning-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 2px 0;
  font: inherit;
  font-size: 12.5px;
  color: var(--xq-text-muted);
  cursor: pointer;
  text-align: left;
  -webkit-user-select: none;
  user-select: none;
}

.reasoning-chev {
  flex: none;
  transition: transform 0.15s ease;
}

.reasoning-chev.is-open {
  transform: rotate(90deg);
}

.reasoning-live {
  width: 100%;
  max-height: 240px;
  margin-top: 6px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.55;
  color: var(--xq-text-muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 2px 4px 2px 10px;
  border-left: 2px solid color-mix(in srgb, var(--xq-accent) 35%, transparent);
  border-radius: 2px;
}

/* —— 首 token 等待动画：星芒呼吸 + 流光字，透明无卡 —— */
.thinking-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}

.thinking-spark {
  flex: none;
  color: var(--xq-accent);
  animation: xq-spark 1.6s ease-in-out infinite;
}

.thinking-shimmer {
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(90deg, var(--xq-text-muted) 20%, var(--xq-accent-deep) 50%, var(--xq-text-muted) 80%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: xq-shimmer 2.4s linear infinite;
}

@keyframes xq-spark {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.82) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.08) rotate(28deg);
  }
}

@keyframes xq-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
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

@media (max-width: 768px) {
  /* 拇指热区：折叠行/来源链接手机端抬高到可点按标准 */
  .reasoning-head,
  .step-toggle {
    min-height: 38px;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .reasoning-live {
    max-height: 45vh;
  }

  .sources-link {
    min-height: 34px;
    display: flex;
    align-items: center;
  }
}
</style>
