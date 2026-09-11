import type { MusicSummary } from './uploadMusic'
import { requestFunc } from '../req'

interface GetMusicListParams {
  search?: string
  limit?: number
  offset?: number
  /** 用于刷新后按已保存的播放列表恢复曲目 */
  ids?: number[]
  /** 只看自己上传的（发帖插入选歌面板用） */
  mine?: boolean
}

/**
 * @description 获取音乐列表（已发布，分页 + 搜索；传 ids 时按 ids 返回；mine=只看自己的）
 */
async function getMusicList(params: GetMusicListParams = {}): Promise<MusicSummary[]> {
  const res = await requestFunc('/auth/getMusicList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      search: params.search ?? '',
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      ids: params.ids ?? [],
      mine: params.mine ?? false,
    },
  }, true)
  if (!res)
    throw new Error('网络错误')
  const data = await res.json()
  if (data.code !== 200)
    throw new Error(data.msg || '列表获取失败')
  return (data.data?.list ?? []) as MusicSummary[]
}

export type { GetMusicListParams }
export { getMusicList }
