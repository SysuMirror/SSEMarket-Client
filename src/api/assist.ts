import { assistBaseUrl } from '@/config/assist'
import type { PendingAssist } from '@/store/postAssistStore'

export interface AssistReference {
  postID: number
  title: string
  url: string
  snippet: string
  heat: number
}

export interface AssistMatchMeta {
  mysql_hits: number
  qdrant_hits: number
  used: number
  took_ms: number
  queries: string[]
  degraded: boolean
  sources_type?: 'local' | 'web' | 'mixed'
}

export interface AssistMatchData {
  answer: string
  references: AssistReference[]
  meta: AssistMatchMeta
}

export interface AssistMatchResponse {
  ok: boolean
  data?: AssistMatchData
  error?: string
}

// ---- 帖子详情页 AI 回答 ----

export interface AssistPostData {
  answer: string
  references: AssistReference[]
  sources_type: 'local' | 'web' | 'mixed'
  web_search_query: string | null
  feedback_upvotes: number
  feedback_downvotes: number
  created_at: string | null
}

export interface AssistPostResponse {
  ok: boolean
  data?: AssistPostData | null
  error?: string
}

// ---- 追问 ----

export interface AssistFollowUpResponse {
  ok: boolean
  data?: { answer: string }
  error?: string
}

/**
 * 调用 sse-market-assist 的 /match（同源 nginx /api/v1/assist/ 转发）。
 * 刻意不走 requestFunc：避免触发 Go 后端的 401 刷新逻辑；
 * 任何失败由调用方静默处理，绝不影响发帖主流程。
 */
export async function fetchAssistMatch(pending: PendingAssist, signal?: AbortSignal): Promise<AssistMatchData> {
  const res = await fetch(`${assistBaseUrl()}/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      partition: pending.partition,
      title: pending.title,
      content: pending.content,
      postID: pending.postID,
    }),
    signal,
  })
  if (!res.ok)
    throw new Error(`assist match 请求失败：${res.status}`)
  const data = await res.json() as AssistMatchResponse
  if (!data.ok || !data.data)
    throw new Error(data.error || 'assist match 返回异常')
  return data.data
}

/**
 * 获取已保存的 AI 回答（帖子详情页置顶展示）。
 */
export async function fetchAssistPost(postID: number): Promise<AssistPostData | null> {
  try {
    const res = await fetch(`${assistBaseUrl()}/post/${postID}`, { method: 'GET' })
    if (!res.ok)
      return null
    const json = await res.json() as AssistPostResponse
    if (!json.ok || !json.data)
      return null
    return json.data
  }
  catch {
    return null
  }
}

/**
 * 追问 AI。
 */
export async function fetchAssistFollowup(
  postID: number,
  question: string,
  history: Array<{ role: string, content: string }>,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${assistBaseUrl()}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postID, question, history }),
      signal,
    })
    if (!res.ok)
      return null
    const json = await res.json() as AssistFollowUpResponse
    if (!json.ok || !json.data)
      return null
    return json.data.answer
  }
  catch {
    return null
  }
}

/**
 * 提交反馈（👍/👎）。
 */
export async function sendAssistFeedback(postID: number, vote: 'up' | 'down'): Promise<boolean> {
  try {
    const res = await fetch(`${assistBaseUrl()}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postID, vote }),
    })
    return res.ok
  }
  catch {
    return false
  }
}
