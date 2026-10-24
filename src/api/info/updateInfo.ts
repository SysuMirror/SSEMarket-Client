import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'

const apiUrl = import.meta.env.VITE_API_BASE_URL

async function updateUserInfo(
  avatarURL: string,
  intro: string,
  name: string,
  userID: number,
  hideProfilePosts?: boolean,
) {
  try {
    const res = await requestFunc(`/auth/updateUserInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        avatarURL,
        intro,
        name,
        userID,
        hideProfilePosts,
      },
    }, true)
    const data = await res!.json()
    return data
  }
  catch (e) {
    console.error(e)
  }
}

/** 设置满级自定义称号(独立端点,不触碰其他资料字段) */
async function setCustomTitle(title: string) {
  try {
    const res = await requestFunc(`/auth/setCustomTitle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { title },
    }, true)
    return await res!.json()
  }
  catch (e) {
    console.error(e)
    return null
  }
}

async function uploadAvatar(photo: File) {
  const token = useUserStore().token.value
  if (!token) {
    return
  }
  const formData = new FormData()

  if (photo instanceof File) {
    formData.append('file', photo, photo.name)
  }
  else {
    console.error('Invalid file object:', photo)
    throw new Error('Invalid file object')
  }

  try {
    const response = await fetch(`${apiUrl}/auth/uploadAvatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  }
  catch (error) {
    console.error('Error uploading photo:', error)
    throw error
  }
}

async function updateEmailPush(user_id: number) {
  try {
    await requestFunc(`/auth/changeEmailPush`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        user_id,
      },
    }, true)
    // const data = await res.json()
    // return data
  }
  catch (e) {
    console.error(e)
  }
}
export interface ProfileBannerResult {
  ok: boolean
  msg: string
  profileBannerUrl: string
  profileBannerOpacity: number
}

/**
 * 保存个人主页顶部栏板背景。
 * bannerUrl 为空表示恢复默认渐变；opacity 0-100，所有访问者都按这个值显示。
 */
async function saveProfileBanner(bannerUrl: string, bannerOpacity: number): Promise<ProfileBannerResult> {
  try {
    const res = await requestFunc('/auth/profile/banner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { bannerUrl, bannerOpacity },
    }, true)
    if (!res)
      return { ok: false, msg: '登录状态已失效，请重新登录', profileBannerUrl: '', profileBannerOpacity: 100 }
    const json = await res.json() as {
      code?: number
      msg?: string
      data?: { profileBannerUrl?: unknown, profileBannerOpacity?: unknown }
    }
    if (json.code !== 200) {
      return { ok: false, msg: json.msg || '保存失败', profileBannerUrl: '', profileBannerOpacity: 100 }
    }
    const url = typeof json.data?.profileBannerUrl === 'string' ? json.data.profileBannerUrl : bannerUrl
    const rawOpacity = Number(json.data?.profileBannerOpacity)
    const opacity = Number.isFinite(rawOpacity) ? Math.min(100, Math.max(0, Math.round(rawOpacity))) : bannerOpacity
    return { ok: true, msg: json.msg || '已保存', profileBannerUrl: url, profileBannerOpacity: opacity }
  }
  catch (e) {
    console.error('[profile] save banner failed', e)
    return { ok: false, msg: '网络异常，请稍后重试', profileBannerUrl: '', profileBannerOpacity: 100 }
  }
}

export { saveProfileBanner, setCustomTitle, updateEmailPush, updateUserInfo, uploadAvatar }
