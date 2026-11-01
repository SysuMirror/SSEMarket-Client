import { opsagentBaseURL } from '@/api/opsagent/baseUrl'
import { OpsAgentRequestError } from '@/api/opsagent/errors'
import { opsagentAuthHeaders } from '@/api/opsagent/headers'
import { ensureAccessToken } from '@/api/req'

/** 重进会话时后端从 checkpoint 重建的工具步骤（与直播 status 事件同款形态，默认折叠） */
export interface BootstrapStep {
  label: string
  text: string
  status: string
}

/** 重进会话时后端解析出的生图卡片（done 带 url/seed；failed 带 error） */
export interface BootstrapImage {
  id: string
  status: 'done' | 'failed'
  url: string
  seed: number | null
  error?: string
}

export interface BootstrapMessage {
  role: string
  content: string
  steps?: BootstrapStep[]
  images?: BootstrapImage[]
  /** 深度思考限幅摘录（后端只存前 2000 字，2026-11-01 用户要求刷新后也可见） */
  reasoning?: string
}

/** 与 OpsAgent `GET /api/v1/agent/conversation/bootstrap` 的 `data` 对齐（`segment_seq`、`archived`；不再使用 `closed`）。 */
export interface ConversationBootstrapData {
  session_id: string
  title: string
  segment_seq: number
  archived: boolean
  /** 生图模式持久化（A5）：threads.mode，开/切会话时恢复 pill */
  mode: 'chat' | 'image'
  messages: BootstrapMessage[]
}

export interface ConversationSummary {
  session_id: string
  title: string
  created_at: string
  updated_at: string
  mode?: string
}

export interface ConversationMessagesData {
  session_id: string
  title: string
  mode?: string
  messages: BootstrapMessage[]
}

interface ApiEnvelope<T> {
  code: number
  msg: string
  data?: T
  request_id?: string
}

/** 后端原始 data：兼容历史字段 `closed`。 */
interface BootstrapPayload {
  session_id?: string
  title?: string
  segment_seq?: number
  archived?: boolean
  closed?: boolean
  mode?: string
  messages?: BootstrapMessage[]
}

function normalizeBootstrapData(raw: BootstrapPayload): ConversationBootstrapData {
  const session_id = String(raw.session_id || '').trim()
  const title = String(raw.title || '').trim()
  const segment_seq = typeof raw.segment_seq === 'number' && !Number.isNaN(raw.segment_seq)
    ? raw.segment_seq
    : 0
  const archived = raw.archived !== undefined
    ? !!raw.archived
    : !!raw.closed
  const mode: 'chat' | 'image' = raw.mode === 'image' ? 'image' : 'chat'
  const messages = Array.isArray(raw.messages) ? raw.messages : []
  return { session_id, title, segment_seq, archived, mode, messages }
}

async function opsagentEnvelope<T>(path: string, init: RequestInit): Promise<T> {
  if (!(await ensureAccessToken()))
    throw new Error('请先登录后再使用小秋')
  const res = await fetch(`${opsagentBaseURL()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...opsagentAuthHeaders(),
    },
  })
  const text = await res.text()
  let body: ApiEnvelope<T>
  try {
    body = JSON.parse(text) as ApiEnvelope<T>
  }
  catch {
    // 非 JSON（如 401/410 的 {detail} 体或网关错误页）：带状态码抛出
    throw new OpsAgentRequestError(res.status, text.trim() || `请求失败（${res.status}）`)
  }
  if (!res.ok || body.code !== 0 || body.data === undefined)
    throw new OpsAgentRequestError(res.status, body.msg || `请求失败（${res.status}）`, body.code)
  return body.data
}

/**
 * GET /api/v1/agent/conversation/bootstrap（不传 sessionId 时服务端恢复最近会话）；
 *  传 sessionId 时走 POST（开新会话并绑定属主）。
 */
export async function fetchConversationBootstrap(sessionId?: string): Promise<ConversationBootstrapData> {
  const raw = sessionId
    ? await opsagentEnvelope<BootstrapPayload>(
        '/api/v1/agent/conversation/bootstrap',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        },
      )
    : await opsagentEnvelope<BootstrapPayload>(
        '/api/v1/agent/conversation/bootstrap',
        { method: 'GET', headers: { Accept: 'application/json' } },
      )
  return normalizeBootstrapData(raw)
}

/** GET /api/v1/agent/conversations —— 会话列表（按最近活跃倒序）。 */
export async function fetchConversations(limit = 50): Promise<ConversationSummary[]> {
  const data = await opsagentEnvelope<{ conversations: ConversationSummary[] }>(
    `/api/v1/agent/conversations?limit=${limit}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  )
  return data.conversations ?? []
}

/** GET /api/v1/agent/conversations/{id}/messages —— 任意历史会话的消息。 */
export async function fetchConversationMessages(sessionId: string): Promise<ConversationMessagesData> {
  return opsagentEnvelope<ConversationMessagesData>(
    `/api/v1/agent/conversations/${encodeURIComponent(sessionId)}/messages`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  )
}

/** POST /api/v1/agent/conversations/{id}/title —— 重命名会话。 */
export async function renameConversation(sessionId: string, title: string): Promise<void> {
  await opsagentEnvelope<unknown>(
    `/api/v1/agent/conversations/${encodeURIComponent(sessionId)}/title`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ title }),
    },
  )
}

/** DELETE /api/v1/agent/conversations/{id} —— 删除会话（列表不再可见，且不可继续对话）。 */
export async function deleteConversation(sessionId: string): Promise<void> {
  await opsagentEnvelope<{ deleted: boolean }>(
    `/api/v1/agent/conversations/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  )
}
