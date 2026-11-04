import { requestFunc } from '../req'
import { setPassword } from './utils'

/**
 *
 * @param {string} userEmail
 * @param {string} userPassword 未加密的密码
 * @returns {Promise<{ token: string; refresh_token: string } | null>} 登录返回的 token 与 refresh_token
 * @throws {Error} 后端拒绝（如主模式 403 提示改用统一登录）
 */
async function userLogin(userEmail: string, userPassword: string): Promise<{ token: string, refresh_token: string } | null> {
  try {
    const res = await requestFunc(`/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        email: userEmail,
        password: setPassword(userPassword, '16bit secret key'),
      },
    }, false)
    if (!res)
      return null
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(typeof data?.msg === 'string' && data.msg ? data.msg : '登录失败')
    }
    const token = data?.data?.token
    const refreshToken = data?.data?.refresh_token

    if (token && refreshToken) {
      return { token, refresh_token: refreshToken }
    }
    throw new Error('登录失败')
  }
  catch (e) {
    console.error(e)
    throw e
  }
}

export { userLogin }
