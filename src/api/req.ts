import { showMsg } from '@/components/MessageBox'
import router from '@/router'
import { useUserStore } from '@/store/userStore'
import { ssoTry } from '@/api/sso/sso'

const apiUrl = import.meta.env.VITE_API_BASE_URL

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

/** refresh 失败后的兜底：用共享父域 sse_sso cookie 静默兑换一次。
 *  ok：本地会话已恢复；logout：共享会话确实失效，应清空并回登录页；
 *  unstable：unisso/网络不可达，不能把故障当登出，保留本地会话。 */
async function recoverViaSso(): Promise<'ok' | 'logout' | 'unstable'> {
  const sso = await ssoTry()
  if (sso.state === 'ok') {
    const { setToken, setRefreshToken } = useUserStore()
    setToken(sso.token)
    setRefreshToken(sso.refresh_token)
    return 'ok'
  }
  return sso.state === 'unauthorized' ? 'logout' : 'unstable'
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
      return fetch(`${finalUrl}`, {
        method: object.method,
        headers: {
          ...object.headers,
          Authorization: `Bearer ${store.token.value}`,
        },
        body: JSON.stringify(object.body),
      })
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
        const rec = await recoverViaSso()
        if (rec === 'ok') {
          res = await doRequest()
          return res
        }
        if (rec === 'logout') {
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
      showMsg('登录过期，请重新登录')
      store.setToken('')
      store.setRefreshToken('')
      return null
    }

    if (res.status !== 401) {
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
      const rec = await recoverViaSso()
      if (rec === 'ok') {
        res = await doRequest()
        return res
      }
      if (rec === 'logout') {
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
    return res
  }
  else {
    const res = await fetch(`${apiUrl}${url}`, {
      method: object.method,
      headers: object.headers,
      body: JSON.stringify(object.body),
    })
    return res
  }
}

export { requestFunc }
