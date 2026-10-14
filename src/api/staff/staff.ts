import { requestFunc } from '../req'

/**
 * 职位账号（开发人员匿名 @）前端 API。
 * 后端保证出参只有 alias / title / 职位小号 userID，绝不含真实开发者信息。
 */

export interface StaffAlias {
  aliasID: number
  alias: string
  title: string
  /** 职位小号 userID：@ 渲染成链接、点进主页都靠它 */
  userID: number
}

async function parseResponse<T>(res: Response): Promise<T | null> {
  const json = await res.json()
  if (!res.ok || json.code !== 200)
    return null
  return json.data as T
}

/** @ 下拉候选：全部职位账号（表为空时返回 []，前端据此隐藏 @ 入口） */
export async function listStaffAliases(): Promise<StaffAlias[]> {
  try {
    const res = await requestFunc(
      '/auth/staff/alias/list',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: {} },
      true,
    )
    if (!res)
      return []
    const data = await parseResponse<{ aliases: StaffAlias[] }>(res)
    return (data?.aliases ?? []).map(a => ({
      aliasID: Number(a.aliasID) || 0,
      alias: String(a.alias ?? ''),
      title: String(a.title ?? ''),
      userID: Number(a.userID) || 0,
    })).filter(a => a.alias && a.userID > 0)
  }
  catch (e) {
    console.error('listStaffAliases failed', e)
    return []
  }
}

/**
 * 当前用户在该帖子线程内被 @ 到的职位身份（「以 XX 身份回复」开关的数据源）。
 * 普通用户恒为 []。
 */
export async function threadStaffAliases(postID: number): Promise<StaffAlias[]> {
  if (!postID)
    return []
  try {
    const res = await requestFunc(
      '/auth/staff/alias/threadAliases',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { postID },
      },
      true,
    )
    if (!res)
      return []
    const data = await parseResponse<{ aliases: StaffAlias[] }>(res)
    return (data?.aliases ?? []).map(a => ({
      aliasID: Number(a.aliasID) || 0,
      alias: String(a.alias ?? ''),
      title: String(a.title ?? ''),
      userID: Number(a.userID) || 0,
    })).filter(a => a.alias && a.userID > 0)
  }
  catch (e) {
    console.error('threadStaffAliases failed', e)
    return []
  }
}
