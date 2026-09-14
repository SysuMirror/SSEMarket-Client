import type { MusicSummary } from './uploadMusic'
import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'

const apiUrl = import.meta.env.VITE_API_BASE_URL

interface PublishMusicParams {
  musicID: number
  title?: string
  artist?: string
  album?: string
  /** 用户自选封面图片文件，优先于内嵌封面 */
  cover?: File | null
}

/**
 * @description 发布音乐（两段式第二步）：multipart 含可编辑的元数据与可选自选封面
 */
async function publishMusic(params: PublishMusicParams): Promise<MusicSummary> {
  const token = useUserStore().token.value
  if (!token)
    throw new Error('登录过期，请重新登录')

  const formData = new FormData()
  formData.append('musicID', String(params.musicID))
  if (params.title)
    formData.append('title', params.title)
  if (params.artist)
    formData.append('artist', params.artist)
  if (params.album)
    formData.append('album', params.album)
  if (params.cover)
    formData.append('cover', params.cover, params.cover.name)

  const res = await fetch(`${apiUrl}/auth/publishMusic`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json()
  if (data.code !== 200)
    throw new Error(data.msg || '发布失败')
  return data.data.music as MusicSummary
}

async function deleteMusic(musicID: number): Promise<void> {
  const res = await requestFunc('/auth/deleteMusic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { musicID },
  }, true)
  if (!res)
    throw new Error('网络错误')
  const data = await res.json()
  if (data.code !== 200)
    throw new Error(data.msg || '删除失败')
}

/** 播放数 +1（失败静默，不影响播放） */
function reportMusicPlayed(musicID: number) {
  requestFunc('/auth/musicPlayed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { musicID },
  }, true).catch(() => {})
}

export type { PublishMusicParams }
export { deleteMusic, publishMusic, reportMusicPlayed }
