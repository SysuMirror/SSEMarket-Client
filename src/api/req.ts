import { reportEviaOperationFailure, trackEvia } from '@/analytics/evia'
import { showMsg } from '@/components/MessageBox'
import router from '@/router'
import { useUserStore } from '@/store/userStore'
import { ssoTry, waitSsoProbeSettled } from '@/api/sso/sso'

const apiUrl = import.meta.env.VITE_API_BASE_URL

function normalizeApiOperation(method: string, url: string): string {
  const cleanPath = url.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id')
  return `api:${method.toUpperCase()}:${cleanPath}`.slice(0, 128)
}

const SLOW_API_THRESHOLD_MS = 1500

function reportSlowRequestIfNeeded(method: string, url: string, status: number, startedAt: number): void {
  const durationMs = Math.round(Date.now() - startedAt)
  if (durationMs < SLOW_API_THRESHOLD_MS)
    return
  trackEvia('api_slow_request', {
    operation: normalizeApiOperation(method, url),
    duration_ms: Math.min(durationMs, 300_000),
    status,
  })
}

function reportHttpFailure(method: string, url: string, status: number): void {
  if (status < 400)
    return
  reportEviaOperationFailure({
    operation: normalizeApiOperation(method, url),
    errorCategory: 'http',
    retryable: status === 408 || status === 429 || status >= 500,
    errorCode: `HTTP_${status}`,
  })
}

function reportNetworkFailure(method: string, url: string, error: unknown): void {
  const isTimeout = error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  reportEviaOperationFailure({
    operation: normalizeApiOperation(method, url),
    errorCategory: isTimeout ? 'timeout' : 'network',
    retryable: true,
    errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
  })
}

let refreshPromise: Promise<void> | null = null

export async function refreshTokenIfNeeded() {
  const { refreshToken, setToken, setRefreshToken } = useUserStore()

  if (!refreshToken.value) {
    throw new Error('No refresh token')
  }

  const res = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken.value }),
  })

  if (!res.ok) {
    throw new Error('Refresh token request failed')
  }

  const data = await res.json()
  const token = data.data?.token
  const newRefreshToken = data.data?.refresh_token

  if (!token || !newRefreshToken) {
    throw new Error('Invalid refresh response')
  }

  setToken(token)
  setRefreshToken(newRefreshToken)
}

/** 在调用 OpsAgent 等需 Bearer 的接口前调用：已有 access token 直接通过；仅有 refresh 时先静默续期。 */
export async function ensureAccessToken(): Promise<boolean> {
  const store = useUserStore()
  if (store.token.value)
    return true
  if (!store.refreshToken.value)
    return false
  try {
    await refreshTokenIfNeeded()
    return !!store.token.value
  }
  catch {
    return false
  }
}

/**
 * 本地没有可用令牌时的会话恢复：用共享父域 sse_sso cookie 静默兑换。
 *
 * ssoTry() 的 6s UI 上界可能先返回 unavailable（真实请求仍在飞），
 * 这里必须等真实结果落定再判定；否则慢链路首屏会被误判成“登录过期”。
 *
 *  - ok：本地会话已恢复；
 *  - unauthorized：共享会话确实失效，应清空并回登录页；
 *  - unavailable：unisso/网络不可达，不能当登出，也不弹“登录过期”。
 *
 * 并发请求共享同一个恢复过程，避免同一时刻打出多次 sso/try。
 */
let recoverPromise: Promise<'ok' | 'unauthorized' | 'unavailable'> | null = null

function recoverSession(): Promise<'ok' | 'unauthorized' | 'unavailable'> {
  if (recoverPromise)
    return recoverPromise
  recoverPromise = (async () => {
    const store = useUserStore()
    // 不因为“store 里还有一个旧 token”就提前返回：refresh 失败后它可能已失效。
    let result = await ssoTry()
    if (result.state === 'unavailable')
      result = await waitSsoProbeSettled() ?? result
    if (result.state === 'ok') {
      store.setToken(result.token)
      store.setRefreshToken(result.refresh_token)
      trackEvia('sso_silent_restored', { source: 'api_recover' })
      return 'ok' as const
    }
    return result.state === 'unauthorized' ? 'unauthorized' as const : 'unavailable' as const
  })().finally(() => {
    recoverPromise = null
  })
  return recoverPromise
}

export interface RequestObject {
  method: string
  headers: HeadersInit
  body?: object
  query?: Record<string, string>
}

/***
 * @param {string} url api地址，只需写https://ssemarket.cn/api 后的部分
 * @param {{method:string,headers:object,body:object|null}} object 请求体
 * @param {boolean} tokenIsNeeded 是否需要token
 * @example requestFunc('/auth/deletePcomment',{
 *  headers:{'Content-Type': 'application/json'},
 *  body:{pcommentID:1}
 * },
 *  true)
 */
async function requestFunc(url: string, object: RequestObject, tokenIsNeeded: boolean = true) {
  if (tokenIsNeeded) {
    const store = useUserStore()
    const finalUrl = `${apiUrl}${url}?${new URLSearchParams(object.query).toString()}`

    const doRequest = async () => {
      const startedAt = Date.now()
      try {
        const response = await fetch(`${finalUrl}`, {
          method: object.method,
          headers: {
            ...object.headers,
            Authorization: `Bearer ${store.token.value}`,
          },
          body: JSON.stringify(object.body),
        })
        if (response.ok)
          reportSlowRequestIfNeeded(object.method, url, response.status, startedAt)
        return response
      }
      catch (err) {
        reportNetworkFailure(object.method, url, err)
        throw err
      }
    }

    let res: Response

    if (store.token.value) {
      res = await doRequest()
    }
    else if (store.refreshToken.value) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            await refreshTokenIfNeeded()
          }
          finally {
            refreshPromise = null
          }
        })()
      }

      try {
        await refreshPromise
      }
      catch (e) {
        console.error('首次刷新 token 失败', e)
        const rec = await recoverSession()
        if (rec === 'ok') {
          res = await doRequest()
          return res
        }
        if (rec === 'unauthorized') {
          showMsg('登录过期，请重新登录')
          store.setToken('')
          store.setRefreshToken('')
          router.push('/auth/login')
        }
        else {
          // unisso 不可达：不当登出处理，保留本地会话下次再试
          showMsg('网络不稳定，请稍后重试')
        }
        return null
      }

      res = await doRequest()
    }
    else {
      // 首屏尚未拿到 access/refresh token：先尝试共享 Cookie 静默登录，
      // 成功就直接重试——不能把“登录态还在路上”当成登录过期。
      const rec = await recoverSession()
      if (rec === 'ok') {
        res = await doRequest()
      }
      else if (rec === 'unauthorized') {
        showMsg('登录过期，请重新登录')
        store.setToken('')
        store.setRefreshToken('')
        router.push('/auth/login')
        return null
      }
      else {
        // unisso 不可达：安静地按未登录处理，不弹“登录过期”
        return null
      }
    }

    if (res.status !== 401) {
      if (!res.ok)
        reportHttpFailure(object.method, url, res.status)
      return res
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          await refreshTokenIfNeeded()
        }
        finally {
          refreshPromise = null
        }
      })()
    }

    try {
      await refreshPromise
    }
    catch (e) {
      console.error('刷新 token 失败', e)
      const rec = await recoverSession()
      if (rec === 'ok') {
        res = await doRequest()
        if (!res.ok)
          reportHttpFailure(object.method, url, res.status)
        return res
      }
      reportEviaOperationFailure({
        operation: normalizeApiOperation(object.method, url),
        errorCategory: rec === 'unauthorized' ? 'http' : 'network',
        retryable: rec !== 'unauthorized',
        errorCode: rec === 'unauthorized' ? 'AUTH_EXPIRED' : 'SSO_UNAVAILABLE',
      })
      if (rec === 'unauthorized') {
        showMsg('登录过期，请重新登录')
        store.setToken('')
        store.setRefreshToken('')
        router.push('/auth/login')
      }
      else {
        // unisso 不可达：不当登出处理，保留本地会话下次再试
        showMsg('网络不稳定，请稍后重试')
      }
      return null
    }

    res = await doRequest()
    if (!res.ok)
      reportHttpFailure(object.method, url, res.status)
    return res
  }
  else {
    const startedAt = Date.now()
    try {
      const res = await fetch(`${apiUrl}${url}`, {
        method: object.method,
        headers: object.headers,
        body: JSON.stringify(object.body),
      })
      if (!res.ok)
        reportHttpFailure(object.method, url, res.status)
      else
        reportSlowRequestIfNeeded(object.method, url, res.status, startedAt)
      return res
    }
    catch (err) {
      reportNetworkFailure(object.method, url, err)
      throw err
    }
  }
}

export { requestFunc }
