import { opsagentBaseURL } from '@/api/opsagent/baseUrl'
import { opsagentAuthHeaders } from '@/api/opsagent/headers'
import { ensureAccessToken } from '@/api/req'

export interface Suggestion {
  text: string
  post_id: string
}

/** GET /api/v1/agent/suggestions —— 开场建议（热帖驱动）。 */
export async function fetchSuggestions(): Promise<Suggestion[]> {
  if (!(await ensureAccessToken()))
    return []
  const res = await fetch(`${opsagentBaseURL()}/api/v1/agent/suggestions`, {
    method: 'GET',
    headers: { Accept: 'application/json', ...opsagentAuthHeaders() },
  })
  if (!res.ok)
    return []
  try {
    const body = await res.json() as { code?: number, data?: { suggestions?: Suggestion[] } }
    return body.data?.suggestions ?? []
  }
  catch {
    return []
  }
}

/** POST /api/v1/agent/feedback —— 消息赞/踩（run_id 来自 final 事件）。 */
export async function submitMessageFeedback(
  runId: string,
  threadId: string,
  rating: 1 | -1,
  comment = '',
): Promise<void> {
  if (!(await ensureAccessToken()))
    throw new Error('请先登录后再使用小秋')
  const res = await fetch(`${opsagentBaseURL()}/api/v1/agent/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...opsagentAuthHeaders() },
    body: JSON.stringify({ run_id: runId, thread_id: threadId, rating, comment }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `反馈提交失败（${res.status}）`)
  }
}
