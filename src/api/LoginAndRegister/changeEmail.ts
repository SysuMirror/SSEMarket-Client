import { showMsg } from '@/components/MessageBox'
import { requestFunc } from '../req'

/**
 * @description 修改邮箱(旧邮箱由后端从登录态推导)。
 *              验证码发送到新邮箱。失败时透传后端具体文案
 *              (邮箱已存在 / 曾用邮箱 / 验证码错误 / 409 信息已变更等)。
 * @param {string} newEmail 新邮箱
 * @param {string} valiCode 发送到新邮箱的验证码
 */
async function changeEmail(newEmail: string, valiCode: string) {
  try {
    const res = await requestFunc(`/auth/modifyEmail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        newEmail,
        valiCode,
      },
    }, true)
    if (!res) {
      return null
    }
    if (!res.ok) {
      const errorData = await res.json()
      if (errorData && typeof errorData.msg === 'string') {
        showMsg(errorData.msg)
      }
      else {
        showMsg('修改邮箱失败')
      }
      return null
    }
    const data = await res.json()
    return data
  }
  catch (e) {
    console.error(e)
    showMsg('修改邮箱失败')
    return null
  }
}

export { changeEmail }
