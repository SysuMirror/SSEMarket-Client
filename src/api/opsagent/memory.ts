import { opsagentBaseURL } from '@/api/opsagent/baseUrl'
import { opsagentAuthHeaders } from '@/api/opsagent/headers'
import { ensureAccessToken } from '@/api/req'

export interface MemoryItem {
  key: string
  text: string
  updated_at: string
}

interface ApiEnvelope<T> {
  code: number
  msg: string
  data?: T
}

async function memoryEnvelope<T>(path: string, init: RequestInit): Promise<T> {
  if (!(await ensureAccessToken()))
    throw new Error('请先登录后再使用小秋')
  const res = await fetch(`${opsagentBaseURL()}${path}`, {
    ...init,
    headers: { ...init.headers, ...opsagentAuthHeaders() },
  })
  const text = await res.text()
  let body: ApiEnvelope<T>
  try {
    body = JSON.parse(text) as ApiEnvelope<T>
  }
  catch {
    throw new Error(text || `请求失败（${res.status}）`)
  }
  if (!res.ok || body.code !== 0 || body.data === undefined)
    throw new Error(body.msg || `请求失败（${res.status}）`)
  return body.data
}

/** GET /api/v1/agent/memory —— 小秋记得我什么（最新在前）。 */
export async function fetchMemories(): Promise<MemoryItem[]> {
  const data = await memoryEnvelope<{ memories: MemoryItem[] }>(
    '/api/v1/agent/memory',
    { method: 'GET', headers: { Accept: 'application/json' } },
  )
  return data.memories ?? []
}

/** DELETE /api/v1/agent/memory/{key}。 */
export async function deleteMemory(key: string): Promise<void> {
  await memoryEnvelope<{ deleted: boolean }>(
    `/api/v1/agent/memory/${encodeURIComponent(key)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  )
}

/** PUT /api/v1/agent/memory/{key}。 */
export async function updateMemory(key: string, text: string): Promise<void> {
  await memoryEnvelope<{ updated: boolean }>(
    `/api/v1/agent/memory/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text }),
    },
  )
}
