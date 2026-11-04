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

export interface SsoModeInfo {
  mode: 'sso' | 'fallback' | 'disabled'
  password_login: boolean
  unisso_healthy?: boolean
  consecutive_failures?: number
  checked_at?: string
  last_error?: string
}

/** 当前登录模式：主模式只走 UniSSO；兜底模式才展示本地密码入口。 */
export async function ssoMode(): Promise<SsoModeInfo | null> {
  try {
    const res = await requestFunc('/sso/mode', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, false)
    if (!res || !res.ok)
      return null
    const data = await res.json()
    return data?.data ?? null
  }
  catch {
    return null
  }
}

/** 未登录 SSO 入口：整页跳转后端 302 到 UniSSO authorize。 */
export function ssoLoginURL(): string {
  return `${apiUrl}/sso/login`
}

export type SsoTryResult =
  | { state: 'ok', token: string, refresh_token: string }
  /** 401：无共享会话 / 会话已失效（如其他平台已登出） —— 本地会话应作废。 */
  | { state: 'unauthorized' }
  /** 503 / 超时 / 网络错误：unisso 不可达 —— 不能把故障当登出，保留本地会话。 */
  | { state: 'unavailable' }

type SsoProbeListener = (result: SsoTryResult) => void

/** UI 等待上界：超时先按不可用放行首屏，请求继续后台进行。 */
const SSO_TRY_UI_WAIT_MS = 6000
/** 真实请求上界：慢链路（首访大 bundle 抢带宽）下 sso/try 可能远晚于 UI 上界才返回。 */
const SSO_TRY_FETCH_TIMEOUT_MS = 15000

let probePromise: Promise<SsoTryResult> | null = null
let probeStartedAt = 0
/** 本轮探测的真实结果；新探测发起时清空。 */
let probeSettledResult: SsoTryResult | null = null
const probeListeners = new Set<SsoProbeListener>()

function runSsoProbe(): Promise<SsoTryResult> {
  return fetchWithTimeout(`${apiUrl}/auth/sso/try`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }, SSO_TRY_FETCH_TIMEOUT_MS)
    .then(async (res): Promise<SsoTryResult> => {
      if (res.status === 401)
        return { state: 'unauthorized' }
      if (!res.ok)
        return { state: 'unavailable' }
      const data = await res.json().catch(() => null)
      const token = data?.data?.token
      const refreshToken = data?.data?.refresh_token
      return token && refreshToken
        ? { state: 'ok', token, refresh_token: refreshToken }
        : { state: 'unavailable' }
    })
    .catch((): SsoTryResult => ({ state: 'unavailable' }))
}

/**
 * 静默 SSO：共享父域 Cookie → unisso 校验 → 本地会话。
 * 返回三态，调用方据此决定保留还是清掉本地会话；自身不抛错、不弹窗、不跳转。
 * 并发调用共享同一个请求；UI 等待有上界（unisso 卡死不能阻塞首屏），超时按
 * 'unavailable' 占位返回但请求继续后台进行，真实结果落定后经 onSsoProbeSettled
 * 通知 —— 慢链路首访"探测被掐死、刷新才登录"的时序竞态由此补救（同 iwiki 加固）。
 */
export function ssoTry(): Promise<SsoTryResult> {
  if (!probePromise) {
    probeStartedAt = Date.now()
    probeSettledResult = null
    const current = runSsoProbe()
    probePromise = current
    current.then((result) => {
      probeSettledResult = result
      for (const listener of [...probeListeners])
        listener(result)
      probeListeners.clear()
    }).catch(() => {}).finally(() => {
      // 落定后允许后续调用发起新一轮探测（如 401 自愈路径的再兑换）。
      if (probePromise === current)
        probePromise = null
    })
  }
  const elapsed = Date.now() - probeStartedAt
  if (elapsed >= SSO_TRY_UI_WAIT_MS) {
    // 上界已过：立即返回占位结果，不再阻塞调用方；真实结果仍会经监听器送达。
    return Promise.resolve({ state: 'unavailable' })
  }
  return Promise.race([
    probePromise,
    new Promise<SsoTryResult>(resolve =>
      setTimeout(() => resolve({ state: 'unavailable' }), SSO_TRY_UI_WAIT_MS - elapsed),
    ),
  ])
}

/**
 * 订阅本轮静默探测的真实结果（每个探测周期至多通知一次）。
 * 若订阅时探测已落定，立即补发该结果。返回解绑函数。
 */
export function onSsoProbeSettled(listener: SsoProbeListener): () => void {
  probeListeners.add(listener)
  if (probeSettledResult)
    listener(probeSettledResult)
  return () => probeListeners.delete(listener)
}

/** 单点登出：吊销 unisso 会话 + 清父域 Cookie；失败不阻塞本地退出。 */
export async function ssoLogout(): Promise<void> {
  try {
    await fetchWithTimeout(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, 3000)
  }
  catch {
    // 本地退出不依赖服务端
  }
}

/** fetch + 超时中断（credentials 默认 same-origin，Cookie 照常携带）。 */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
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
