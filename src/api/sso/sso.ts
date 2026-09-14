import { setPassword } from '@/api/LoginAndRegister/utils'
import { requestFunc } from '@/api/req'

const apiUrl = import.meta.env.VITE_API_BASE_URL

export interface SsoExchangeResult {
  type: 'login' | 'bind_needed' | 'bound'
  token?: string
  refresh_token?: string
  sso_username?: string
  sso_email?: string
}

export interface SsoStatus {
  bound: boolean
  sso_username?: string
  bound_at?: string
}

/** 未登录 SSO 入口：整页跳转后端 302 到 UniSSO authorize。 */
export function ssoLoginURL(): string {
  return `${apiUrl}/sso/login`
}

/** ticket → 登录令牌（login/bound，一次性）或 bind_needed 信息（可重复读）。 */
export async function ssoExchange(ticket: string): Promise<SsoExchangeResult | null> {
  const res = await requestFunc('/sso/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ticket },
  }, false)
  if (!res || !res.ok)
    return null
  const data = await res.json()
  return data?.data ?? null
}

/** bind_needed ticket + 集市邮箱密码 → 写绑定 + 发令牌。失败抛 Error(msg)。 */
export async function ssoBind(ticket: string, email: string, password: string): Promise<{ token: string, refresh_token: string } | null> {
  const res = await requestFunc('/sso/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { ticket, email, password: setPassword(password, '16bit secret key') },
  }, false)
  if (!res)
    return null
  const data = await res.json()
  if (!res.ok)
    throw new Error(typeof data?.msg === 'string' ? data.msg : '绑定失败')
  const token = data?.data?.token
  const refreshToken = data?.data?.refresh_token
  return token && refreshToken ? { token, refresh_token: refreshToken } : null
}

/** 已登录用户发起绑定：返回 authorize_url，前端整页跳转。 */
export async function ssoBindStart(): Promise<string | null> {
  const res = await requestFunc('/sso/bind/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {},
  }, true)
  if (!res || !res.ok)
    return null
  const data = await res.json()
  return data?.data?.authorize_url ?? null
}

/** 查询当前用户 SSO 绑定状态。 */
export async function ssoStatus(): Promise<SsoStatus | null> {
  const res = await requestFunc('/sso/status', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, true)
  if (!res || !res.ok)
    return null
  const data = await res.json()
  return data?.data ?? null
}

/** 验证登录密码后解绑 SSO。 */
export async function ssoUnbind(password: string): Promise<boolean> {
  const res = await requestFunc('/sso/unbind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { password: setPassword(password, '16bit secret key') },
  }, true)
  return !!res && res.ok
}
