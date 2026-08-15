import { showMsg } from '@/components/MessageBox'
import { requestFunc } from '../req'

// PAT scope 单条定义（与后端 domain.UserAPITokenScope 对齐）
export interface APITokenScope {
  name: string
  description: string
}

// PAT 列表项（不含明文 token）
export interface APITokenItem {
  token_id: number
  prefix: string
  name: string
  scopes: string
  last_used_at: string | null
  is_active: boolean
  created_at: string
}

export interface APITokenPage {
  records: APITokenItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// 创建 PAT 的返回（含明文 token，仅此一次）
export interface APITokenCreateResult {
  token_id: number
  token: string
  prefix: string
  name: string
  scopes: string
  is_active: boolean
  created_at: string
}

interface BackendEnvelope<T> {
  code: number
  data: T
  msg: string
}

/**
 * 解析后端 envelope，防御非 JSON 响应（如网关 404 纯文本、502 HTML）。
 * - 空响应或非 JSON：抛带 HTTP 状态码与响应片段的错误
 * - 合法 JSON 但 code !== 200：抛 envelope.msg
 */
async function parseEnvelope<T>(res: Response, fallbackMsg: string): Promise<BackendEnvelope<T>> {
  const text = await res.text()
  if (!text) {
    throw new Error(`${fallbackMsg}（HTTP ${res.status}，空响应）`)
  }
  let parsed: BackendEnvelope<T>
  try {
    parsed = JSON.parse(text) as BackendEnvelope<T>
  }
  catch {
    // 例如 Gin 默认 404 "404 page not found" 会让 JSON.parse 抛 SyntaxError
    throw new Error(`${fallbackMsg}（HTTP ${res.status}：${text.slice(0, 80)}）`)
  }
  if (parsed.code !== 200) {
    throw new Error(parsed.msg || `${fallbackMsg}（code ${parsed.code}）`)
  }
  return parsed
}

/** GET /auth/token/scopes 获取可用 scope 列表 */
export async function listAPITokenScopes(): Promise<APITokenScope[]> {
  const res = await requestFunc('/auth/token/scopes', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, true)
  if (!res)
    return []
  try {
    const data = await parseEnvelope<{ scopes: APITokenScope[] }>(res, '获取 scope 列表失败')
    return data.data?.scopes || []
  }
  catch (e: any) {
    showMsg(e?.message || '获取 scope 列表失败')
    return []
  }
}

/** POST /auth/token/create 创建 PAT。明文 token 仅在此返回一次。 */
export async function createAPIToken(name: string, scopes: string[]): Promise<APITokenCreateResult | null> {
  const res = await requestFunc('/auth/token/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { name, scopes },
  }, true)
  if (!res)
    return null
  const data = await parseEnvelope<APITokenCreateResult>(res, '创建失败')
  return data.data
}

/** GET /auth/token/list?page=&page_size= 列出当前用户 PAT */
export async function listAPITokens(page = 1, pageSize = 50): Promise<APITokenPage | null> {
  const res = await requestFunc('/auth/token/list', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    query: { page: String(page), page_size: String(pageSize) },
  }, true)
  if (!res)
    return null
  const data = await parseEnvelope<APITokenPage>(res, '查询 token 列表失败')
  return data.data
}

/** POST /auth/token/revoke 吊销 PAT（软删，is_active=0） */
export async function revokeAPIToken(tokenID: number): Promise<boolean> {
  const res = await requestFunc('/auth/token/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { token_id: tokenID },
  }, true)
  if (!res)
    return false
  await parseEnvelope<{ token_id: number }>(res, '吊销失败')
  return true
}

/** POST /auth/token/delete 硬删已吊销的 PAT 记录。活跃 token 必须先吊销才能删除。 */
export async function deleteAPIToken(tokenID: number): Promise<boolean> {
  const res = await requestFunc('/auth/token/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { token_id: tokenID },
  }, true)
  if (!res)
    return false
  await parseEnvelope<{ token_id: number }>(res, '删除失败')
  return true
}
