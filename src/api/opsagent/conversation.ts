import { opsagentBaseURL } from '@/api/opsagent/baseUrl'
import { opsagentAuthHeaders } from '@/api/opsagent/headers'
import { ensureAccessToken } from '@/api/req'

export interface BootstrapMessage {
  role: string
  content: string
}

/** 与 OpsAgent `GET /api/v1/agent/conversation/bootstrap` 的 `data` 对齐（`segment_seq`、`archived`；不再使用 `closed`）。 */
export interface ConversationBootstrapData {
  session_id: string
  segment_seq: number
  archived: boolean
  messages: BootstrapMessage[]
}

interface ApiEnvelope<T> {
  code: number
  msg: string
  data?: T
  request_id?: string
}

/** 后端原始 data：兼容历史字段 `closed`。 */
type BootstrapPayload = {
  session_id?: string
  segment_seq?: number
  archived?: boolean
  closed?: boolean
  messages?: BootstrapMessage[]
}

function normalizeBootstrapData(raw: BootstrapPayload): ConversationBootstrapData {
  const session_id = String(raw.session_id || '').trim()
  const segment_seq = typeof raw.segment_seq === 'number' && !Number.isNaN(raw.segment_seq)
    ? raw.segment_seq
    : 0
  const archived = raw.archived !== undefined
    ? !!raw.archived
    : !!raw.closed
  const messages = Array.isArray(raw.messages) ? raw.messages : []
  return { session_id, segment_seq, archived, messages }
}

/** GET /api/v1/agent/conversation/bootstrap */
export async function fetchConversationBootstrap(): Promise<ConversationBootstrapData> {
  if (!(await ensureAccessToken())) {
    throw new Error('请先登录后再使用智能小秋')
  }
  const res = await fetch(`${opsagentBaseURL()}/api/v1/agent/conversation/bootstrap`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...opsagentAuthHeaders(),
    },
  })
  const text = await res.text()
  let body: ApiEnvelope<BootstrapPayload>
  try {
    body = JSON.parse(text) as ApiEnvelope<BootstrapPayload>
  }
  catch {
    throw new Error(text || `bootstrap 失败（${res.status}）`)
  }
  if (res.status === 503 || body.code === 50301) {
    throw new Error(body.msg || '会话服务未就绪（需配置 Redis）')
  }
  if (!res.ok || body.code !== 0 || !body.data) {
    throw new Error(body.msg || `bootstrap 失败（${res.status}）`)
  }
  return normalizeBootstrapData(body.data)
}

/** POST /api/v1/agent/conversation/close */
export async function closeConversation(sessionId: string): Promise<void> {
  if (!(await ensureAccessToken())) {
    throw new Error('请先登录后再使用智能小秋')
  }
  const res = await fetch(`${opsagentBaseURL()}/api/v1/agent/conversation/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...opsagentAuthHeaders(),
    },
    body: JSON.stringify({ session_id: sessionId }),
  })
  const text = await res.text()
  let body: ApiEnvelope<unknown>
  try {
    body = JSON.parse(text) as ApiEnvelope<unknown>
  }
  catch {
    throw new Error(text || `关闭会话失败（${res.status}）`)
  }
  if (!res.ok || body.code !== 0) {
    throw new Error(body.msg || `关闭会话失败（${res.status}）`)
  }
}
