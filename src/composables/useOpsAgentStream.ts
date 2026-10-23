import type { Ref, ShallowRef } from 'vue'
import { ref, shallowRef } from 'vue'
import { opsagentBaseURL } from '@/api/opsagent/baseUrl'
import { OpsAgentRequestError, parseOpsAgentJsonError } from '@/api/opsagent/errors'
import { opsagentAuthHeaders } from '@/api/opsagent/headers'
import { ensureAccessToken } from '@/api/req'

export type AssistantStatus = 'streaming' | 'done' | 'error'

export interface TimelineUser {
  kind: 'user'
  id: string
  text: string
  time: string
}

export interface TimelineAssistant {
  kind: 'assistant'
  id: string
  text: string
  time: string
  status: AssistantStatus
  /** 服务端 run_id（final 事件携带），消息赞/踩反馈绑定用 */
  runId?: string
  /** 模型深度思考过程（reasoning 事件累计） */
  reasoning?: string
}

/** 子专家中间摘要（SSE 无 round，带【标签】前缀） */
export interface TimelineStep {
  kind: 'step'
  id: string
  label: string
  text: string
  time: string
  status: 'streaming' | 'done'
  collapsed: boolean
}

export interface TimelineMeta {
  kind: 'meta'
  id: string
  source: 'rag_context' | 'search_context' | 'ping' | string
  label: string
  detail: string
}

export interface PostDraftPayload {
  type: 'post' | 'product'
  title: string
  content: string
  partition?: string
  tags?: string[]
  price?: number
  is_anonymous?: boolean
  is_private?: boolean
}

export interface TimelinePostDraft {
  kind: 'post_draft'
  id: string
  draft: PostDraftPayload
  status: 'editing' | 'submitting' | 'success' | 'error'
  result?: { post_id?: number, product_id?: number, url?: string }
  error?: string
}

export type TimelineItem = TimelineUser | TimelineAssistant | TimelineStep | TimelineMeta | TimelinePostDraft

const SPECIALIST_PREFIX_RE = /^【[^】]+】/

function formatTime(d: Date) {
  return d.toLocaleTimeString().slice(0, 5)
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeFrame(raw: string) {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function parseSSEFrame(frame: string) {
  const lines = normalizeFrame(frame).split('\n')
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:'))
      eventName = line.slice(6).trim()
    else if (line.startsWith('data:'))
      dataLines.push(line.slice(5).trim())
  }
  const rawJson = dataLines.join('\n')
  if (!rawJson)
    return null
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(rawJson) as Record<string, unknown>
  }
  catch {
    payload = { text: rawJson }
  }
  return { eventName, payload }
}

function num(v: unknown, def = -1): number {
  if (typeof v === 'number' && !Number.isNaN(v))
    return v
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10)
    return Number.isNaN(n) ? def : n
  }
  return def
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function hasSupervisorRound(payload: Record<string, unknown>): boolean {
  return 'round' in payload && num(payload.round) >= 0
}

function isSpecialistStep(text: string, payload: Record<string, unknown>): boolean {
  if (str(payload.mode) !== 'replace')
    return false
  if (hasSupervisorRound(payload))
    return false
  return SPECIALIST_PREFIX_RE.test(text)
}

function extractStepLabel(text: string): string {
  const m = text.match(/^(【[^】]+】)/)
  return m?.[1] ?? '【专家进展】'
}

function stripStepLabel(text: string): string {
  return text.replace(/^【[^】]+】\n?/, '')
}

export interface SendAgentOptions {
  sessionId: string
  task: string
  onAfterUpdate?: () => void
}

/**
 * 共享流状态：同 shareKey 复用同一份（模块级），组件卸载不销毁。
 * 背景：聊天页切路由即卸载组件，实例级状态随组件销毁——正在生成的回复在
 * UI 上"中断"，切回只能重新 bootstrap，看不到仍在跑的流（还诱发重发双跑）。
 * 共享模式下连 sessionId 一起保留：切回时按原会话续看，不重新拉最近会话。
 * 不传 shareKey = 实例模式，行为与历史版本完全一致（PostDraftCard 等继续用）。
 */
interface SharedStreamState {
  timeline: ShallowRef<TimelineItem[]>
  globalError: Ref<string>
  isStreaming: Ref<boolean>
  sessionId: Ref<string>
  holder: { abortController: AbortController | null }
  streamElapsed: Ref<number>
  streamElapsedTimer: { id: ReturnType<typeof setInterval> | null }
}

const sharedStates = new Map<string, SharedStreamState>()

export function useOpsAgentStream(shareKey?: string) {
  let timeline: ShallowRef<TimelineItem[]>
  let globalError: Ref<string>
  let isStreaming: Ref<boolean>
  let sessionId: Ref<string>
  let holder: { abortController: AbortController | null }
  let streamElapsed: Ref<number>
  let streamElapsedTimer: { id: ReturnType<typeof setInterval> | null }

  if (shareKey) {
    let st = sharedStates.get(shareKey)
    if (!st) {
      st = {
        timeline: shallowRef<TimelineItem[]>([]),
        globalError: ref(''),
        isStreaming: ref(false),
        sessionId: ref(''),
        holder: { abortController: null },
        streamElapsed: ref(0),
        streamElapsedTimer: { id: null },
      }
      sharedStates.set(shareKey, st)
    }
    timeline = st.timeline
    globalError = st.globalError
    isStreaming = st.isStreaming
    sessionId = st.sessionId
    holder = st.holder
    streamElapsed = st.streamElapsed
    streamElapsedTimer = st.streamElapsedTimer
  }
  else {
    timeline = shallowRef<TimelineItem[]>([])
    globalError = ref('')
    isStreaming = ref(false)
    sessionId = ref('')
    holder = { abortController: null }
    streamElapsed = ref(0)
    streamElapsedTimer = { id: null }
  }

  // 流已计时：首 token 前用户能从秒数判断"在算"还是"挂了"
  function startStreamElapsed() {
    streamElapsed.value = 0
    stopStreamElapsed()
    streamElapsedTimer.id = setInterval(() => {
      streamElapsed.value++
    }, 1000)
  }

  function stopStreamElapsed() {
    if (streamElapsedTimer.id !== null) {
      clearInterval(streamElapsedTimer.id)
      streamElapsedTimer.id = null
    }
  }

  function bump() {
    timeline.value = [...timeline.value]
  }

  function abort() {
    holder.abortController?.abort()
    holder.abortController = null
  }

  function lastUserIndex(): number {
    for (let i = timeline.value.length - 1; i >= 0; i--) {
      if (timeline.value[i].kind === 'user')
        return i
    }
    return -1
  }

  function ensureAssistantTail(): TimelineAssistant {
    const last = timeline.value[timeline.value.length - 1]
    if (last && last.kind === 'assistant' && last.status === 'streaming')
      return last
    const a: TimelineAssistant = {
      kind: 'assistant',
      id: newId('as'),
      text: '',
      time: formatTime(new Date()),
      status: 'streaming',
    }
    timeline.value = [...timeline.value, a]
    return a
  }

  function ensureActiveStep(): TimelineStep {
    const start = lastUserIndex()
    for (let i = timeline.value.length - 1; i > start; i--) {
      const item = timeline.value[i]
      if (item.kind === 'step' && item.status === 'streaming')
        return item
    }
    const step: TimelineStep = {
      kind: 'step',
      id: newId('step'),
      label: '【专家进展】',
      text: '',
      time: formatTime(new Date()),
      status: 'streaming',
      collapsed: false,
    }
    const items = [...timeline.value]
    let insertAt = start + 1
    while (insertAt < items.length && items[insertAt].kind === 'step')
      insertAt++
    items.splice(insertAt, 0, step)
    timeline.value = items
    return step
  }

  function finalizeActiveSteps() {
    const start = lastUserIndex()
    timeline.value = timeline.value.map((item, i) => {
      if (i <= start || item.kind !== 'step' || item.status === 'done')
        return item
      return { ...item, status: 'done' as const, collapsed: true }
    })
  }

  function applyContentV2(payload: Record<string, unknown>, onAfterUpdate?: () => void) {
    const mode = str(payload.mode)
    const text = str(payload.text)

    if (mode === 'final') {
      finalizeActiveSteps()
      const assistant = ensureAssistantTail()
      assistant.text = text
      assistant.status = 'done'
      const runId = str(payload.run_id)
      if (runId)
        assistant.runId = runId
      bump()
      onAfterUpdate?.()
      return
    }

    if (isSpecialistStep(text, payload)) {
      const step = ensureActiveStep()
      step.label = extractStepLabel(text)
      step.text = stripStepLabel(text)
      step.collapsed = false
      bump()
      onAfterUpdate?.()
      return
    }

    if (hasSupervisorRound(payload) || mode === 'append') {
      finalizeActiveSteps()
      const assistant = ensureAssistantTail()
      if (mode === 'append')
        assistant.text += text
      else
        assistant.text = text
      bump()
      onAfterUpdate?.()
      return
    }

    const assistant = ensureAssistantTail()
    assistant.text = text
    bump()
    onAfterUpdate?.()
  }

  function handleMetaEvent(eventName: string, payload: Record<string, unknown>) {
    if (eventName === 'ping')
      return
    const label = eventName
    let detail = ''
    try {
      detail = JSON.stringify(payload, null, 0).slice(0, 4000)
    }
    catch {
      detail = String(payload)
    }
    const meta: TimelineMeta = {
      kind: 'meta',
      id: newId('meta'),
      source: eventName,
      label,
      detail,
    }
    timeline.value = [...timeline.value, meta]
  }

  /** 工具调用步骤（status 事件）：一次性完成，默认折叠，仅展示"查了什么"。 */
  function pushToolStep(tool: string, args: string) {
    const step: TimelineStep = {
      kind: 'step',
      id: newId('step'),
      label: `【${tool}】`,
      text: args || '正在调用工具…',
      time: formatTime(new Date()),
      status: 'done',
      collapsed: true,
    }
    const items = [...timeline.value]
    // 插到最后一个用户消息之后、assistant 气泡之前
    let insertAt = lastUserIndex() + 1
    while (insertAt < items.length && items[insertAt].kind === 'step')
      insertAt++
    items.splice(insertAt, 0, step)
    timeline.value = items
  }

  async function sendAgentMessage(opts: SendAgentOptions) {
    const { sessionId, task, onAfterUpdate } = opts
    globalError.value = ''
    if (!(await ensureAccessToken())) {
      globalError.value = '请先登录后再发送消息'
      onAfterUpdate?.()
      return
    }
    isStreaming.value = true
    holder.abortController = new AbortController()
    // 发送即出思考态气泡（打字动画），不等首 token——否则首 token 慢时页面对用户表现为"没反应"
    ensureAssistantTail()
    bump()
    startStreamElapsed()
    let aborted = false
    let gotStream = false

    const body: Record<string, unknown> = {
      session_id: sessionId,
      task,
    }

    try {
      let res: Response | undefined
      try {
        res = await fetch(`${opsagentBaseURL()}/api/v1/agent/task/sse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...opsagentAuthHeaders(),
          },
          body: JSON.stringify(body),
          signal: holder.abortController.signal,
        })
      }
      catch (e) {
        // 用户主动停止：静默收尾（保留已流出文本），不算错误
        if (e instanceof DOMException && e.name === 'AbortError')
          aborted = true
        else
          throw e
      }

      if (aborted || !res)
        return

      if (!res.ok || !res.body) {
        const t = await res.text()
        const p = parseOpsAgentJsonError(t)
        const msg = p.msg || `请求失败（${res.status}）`
        // 占位气泡直接变错误文案，别留一个空转的思考气泡
        const assistant = ensureAssistantTail()
        assistant.text = msg
        assistant.status = 'error'
        bump()
        throw new OpsAgentRequestError(res.status, msg, p.code)
      }

      gotStream = true

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done)
          break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(/\n\n/)
        buffer = parts.pop() || ''
        for (const part of parts) {
          const parsed = parseSSEFrame(part)
          if (!parsed)
            continue
          const { eventName, payload } = parsed

          if (eventName === 'ping')
            continue

          if (eventName === 'reasoning') {
            const assistant = ensureAssistantTail()
            assistant.reasoning = (assistant.reasoning || '') + str(payload.text)
            bump()
            onAfterUpdate?.()
            continue
          }

          if (eventName === 'content' && num(payload.schema_version) === 2) {
            applyContentV2(payload, onAfterUpdate)
            continue
          }

          if (eventName === 'status') {
            pushToolStep(str(payload.tool) || '工具', str(payload.args))
            onAfterUpdate?.()
            continue
          }

          if (eventName === 'error') {
            const msg = str(payload.message) || '对话服务异常'
            globalError.value = msg
            const assistant = ensureAssistantTail()
            assistant.status = 'error'
            assistant.text = assistant.text.trim() ? assistant.text : msg
            bump()
            onAfterUpdate?.()
            continue
          }

          if (eventName === 'rag_context' || eventName === 'search_context') {
            if (import.meta.env.DEV) {
              handleMetaEvent(eventName, payload)
              onAfterUpdate?.()
            }
            continue
          }

          if (eventName === 'post_draft') {
            const draft: PostDraftPayload = {
              type: payload.type === 'product' ? 'product' : 'post',
              title: str(payload.title),
              content: str(payload.content),
              partition: str(payload.partition) || undefined,
              tags: Array.isArray(payload.tags)
                ? (payload.tags as unknown[]).filter((x): x is string => typeof x === 'string')
                : undefined,
              price: num(payload.price, 0) || undefined,
              is_anonymous: typeof payload.is_anonymous === 'boolean' ? payload.is_anonymous : undefined,
              is_private: typeof payload.is_private === 'boolean' ? payload.is_private : undefined,
            }
            const item: TimelinePostDraft = {
              kind: 'post_draft',
              id: newId('draft'),
              draft,
              status: 'editing',
            }
            timeline.value = [...timeline.value, item]
            bump()
            onAfterUpdate?.()
            continue
          }
        }
      }

    }
    catch (e) {
      // 停止生成不是错误：静默收尾；其余异常复位状态后原样抛给调用方
      if (e instanceof DOMException && e.name === 'AbortError') {
        aborted = true
      }
      else {
        throw e
      }
    }
    finally {
      stopStreamElapsed()
      finalizeActiveSteps()
      const tail = timeline.value[timeline.value.length - 1]
      if (tail && tail.kind === 'assistant' && tail.status === 'streaming') {
        if (!tail.text.trim()) {
          if (aborted) {
            tail.text = '已停止生成。'
          }
          else if (!gotStream) {
            tail.text = '连接失败，请检查网络后重试。'
            tail.status = 'error'
          }
          else {
            tail.text = '当前没有生成有效回复，请稍后重试。'
          }
        }
        if (tail.status === 'streaming')
          tail.status = 'done'
        bump()
      }
      isStreaming.value = false
      holder.abortController = null
      onAfterUpdate?.()
    }
  }

  function pushUserMessage(text: string) {
    const u: TimelineUser = {
      kind: 'user',
      id: newId('u'),
      text,
      time: formatTime(new Date()),
    }
    timeline.value = [...timeline.value, u]
  }

  function resetTimeline() {
    timeline.value = []
    globalError.value = ''
  }

  function seedWelcomeMessages() {
    const now = formatTime(new Date())
    timeline.value = [
      {
        kind: 'assistant',
        id: 'wel-1',
        text: '我是小秋，论坛的事都能搭把手——查帖子、翻知识库、发帖评论，说一声就办。',
        time: now,
        status: 'done',
      },
    ]
  }

  return {
    timeline,
    globalError,
    isStreaming,
    streamElapsed,
    sessionId,
    sendAgentMessage,
    pushUserMessage,
    resetTimeline,
    seedWelcomeMessages,
    abort,
  }
}
