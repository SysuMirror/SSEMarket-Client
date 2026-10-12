import { requestFunc } from '../req'

export interface getInfoResponse {
  code: number
  data: {
    user: UserInfo
  } | null
}

export interface UserInfo {
  userID: number
  name: string
  avatarURL: string
  phone: string
  email: string
  identity: string
  /** 站内币余额（见币中心 /coin） */
  coins: number
}

/**
 * @description 获取用户的邮箱、身份、用户名、手机
 *              只有登录的时候使用
 *
 */
async function getInfo(): Promise<UserInfo> {
  try {
    const res = await requestFunc(
      `/auth/info`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      true,
    )
    const data = await res!.json()
    return data.data.user
  }
  catch (e) {
    console.error(e)
    return {
      userID: 0,
      name: '',
      avatarURL: '',
      phone: '',
      email: '',
      identity: '',
      coins: 0,
    }
  }
}

/** 将接口中的 0/1、字符串等统一为 boolean */
export function coerceApiBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

/**
 * 后端 emailpush / emailNotificationBlocked 均表示 is_email_notification_blocked：
 * true = 已禁用邮件通知（不是「已开启推送」）
 */
export function isEmailNotificationBlocked(value: unknown): boolean {
  return coerceApiBool(value)
}

export interface AllInfo {
  avatarURL: string
  ban: string
  email: string
  /** @deprecated 与 emailNotificationBlocked 同义，true 表示已禁用邮件通知 */
  emailpush: boolean
  /** 与 emailpush 相同，语义更清晰 */
  emailNotificationBlocked?: boolean
  intro: string
  name: string
  phone: string
  punishnum: number
  score: number
  /** Lv8 用户自定义称号;空=未自定义 */
  customTitle: string
  userID: number
  /** 为 true 时，其他用户在其个人主页看不到发帖列表 */
  hideProfilePosts?: boolean
  /** 站内币余额；后端只在本人查看自己主页时返回，他人主页为 undefined */
  coins?: number
}

export function normalizeAllInfo(raw: Partial<AllInfo> | Record<string, unknown>): AllInfo {
  const src = raw as Record<string, unknown>
  const blocked = isEmailNotificationBlocked(
    src.emailNotificationBlocked ?? src.emailpush,
  )
  return {
    avatarURL: String(src.avatarURL ?? ''),
    ban: String(src.ban ?? ''),
    email: String(src.email ?? ''),
    emailpush: blocked,
    emailNotificationBlocked: blocked,
    intro: String(src.intro ?? ''),
    name: String(src.name ?? ''),
    phone: String(src.phone ?? ''),
    punishnum: Number(src.punishnum ?? 0),
    score: Number(src.score ?? 0),
    customTitle: String(src.customTitle ?? ''),
    userID: Number(src.userID ?? 0),
    hideProfilePosts: coerceApiBool(src.hideProfilePosts),
    coins: src.coins === undefined || src.coins === null ? undefined : Number(src.coins),
  }
}

/**
 * @description 获取当前登录用户的详细信息（个人设置页等）
 */
async function getSelfAllInfo(userID: number): Promise<AllInfo> {
  if (userID <= 0)
    return normalizeAllInfo({})
  return getInfoById(userID)
}

/**
 * @deprecated 请使用 getSelfAllInfo(userID)。phone 字段已废弃，仅保留兼容旧调用。
 */
async function getAllInfo(userTelephone: string): Promise<AllInfo> {
  console.warn('[getAllInfo] phone 参数已废弃，请改用 getSelfAllInfo(userID)')
  if (!userTelephone?.trim())
    return normalizeAllInfo({})
  try {
    const res = await requestFunc(
      `/auth/getInfo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { phone: userTelephone },
      },
      true,
    )
    const data = await res!.json()
    return normalizeAllInfo(data)
  }
  catch (e) {
    console.error(e)
    return normalizeAllInfo({})
  }
}

// 这玩意怎么有两个接口??
async function getInfoById(userID: number): Promise<AllInfo> {
  try {
    const res = await requestFunc(
      `/auth/getInfo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { userID },
      },
      true,
    )
    const data = await res!.json()
    return normalizeAllInfo(data)
  }
  catch (e) {
    console.error(e)
    throw e
  }
}

export { getAllInfo, getInfo, getInfoById, getSelfAllInfo }
