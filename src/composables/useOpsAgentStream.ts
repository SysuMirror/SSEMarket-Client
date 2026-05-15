import { opsagentBaseURL } from '@/api/opsagent/baseUrl'
import { OpsAgentRequestError, parseOpsAgentJsonError } from '@/api/opsagent/errors'
import { opsagentAuthHeaders } from '@/api/opsagent/headers'
import { ensureAccessToken } from '@/api/req'
import { ref, shallowRef } from 'vue'

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

export type TimelineItem = TimelineUser | TimelineAssistant | TimelineStep | TimelineMeta

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

export function useOpsAgentStream() {
  const timeline = shallowRef<TimelineItem[]>([])
  const globalError = ref('')
  const isStreaming = ref(false)
  let abortController: AbortController | null = null

  function bump() {
    timeline.value = [...timeline.value]
  }

  function abort() {
    abortController?.abort()
    abortController = null
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

  async function sendAgentMessage(opts: SendAgentOptions) {
    const { sessionId, task, onAfterUpdate } = opts
    globalError.value = ''
    if (!(await ensureAccessToken())) {
      globalError.value = '请先登录后再发送消息'
      onAfterUpdate?.()
      return
    }
    isStreaming.value = true
    abortController = new AbortController()

    const body: Record<string, unknown> = {
      session_id: sessionId,
      task,
    }

    const res = await fetch(`${opsagentBaseURL()}/api/v1/agent/task/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...opsagentAuthHeaders(),
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    })

    if (!res.ok || !res.body) {
      isStreaming.value = false
      const t = await res.text()
      const p = parseOpsAgentJsonError(t)
      throw new OpsAgentRequestError(res.status, p.msg || `请求失败（${res.status}）`, p.code)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    try {
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

          if (eventName === 'content' && num(payload.schema_version) === 2) {
            applyContentV2(payload, onAfterUpdate)
            continue
          }

          if (eventName === 'error') {
            const msg = str(payload.message) || '对话服务异常'
            globalError.value = msg
            const tail = timeline.value[timeline.value.length - 1]
            if (tail && tail.kind === 'assistant' && tail.status === 'streaming') {
              tail.status = 'error'
              tail.text = tail.text || msg
              bump()
            }
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
        }
      }
    }
    finally {
      finalizeActiveSteps()
      const tail = timeline.value[timeline.value.length - 1]
      if (tail && tail.kind === 'assistant' && tail.status === 'streaming') {
        if (!tail.text.trim())
          tail.text = '当前没有生成有效回复，请稍后重试。'
        tail.status = 'done'
        bump()
      }
      isStreaming.value = false
      abortController = null
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
        text: '你好，我是小秋，可以帮你检索论坛帖子、整理要点或回答与社区相关的问题。欢迎来找我聊天~',
        time: now,
        status: 'done',
      },
    ]
  }

  return {
    timeline,
    globalError,
    isStreaming,
    sendAgentMessage,
    pushUserMessage,
    resetTimeline,
    seedWelcomeMessages,
    abort,
  }
}
