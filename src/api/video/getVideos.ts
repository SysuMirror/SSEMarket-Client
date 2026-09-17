import type { PublicVideo } from '@/types/video'

export interface VideoPage {
  list: PublicVideo[]
  total: number
  page: number
  pageSize: number
}

interface ApiResponse<T> {
  code: number
  data: T
  msg?: string
}

async function requestVideo<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`)
  if (!response.ok)
    throw new Error('网络错误')
  const payload = (await response.json()) as ApiResponse<T>
  if (payload.code !== 200)
    throw new Error(payload.msg || '视频获取失败')
  return payload.data
}

async function getVideos(params: { page?: number, pageSize?: number, keyword?: string } = {}): Promise<VideoPage> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 12),
    keyword: params.keyword ?? '',
  })
  return requestVideo<VideoPage>(`/auth/videos?${query}`)
}

async function getVideo(id: number): Promise<PublicVideo> {
  const data = await requestVideo<{ video: PublicVideo }>(`/auth/videos/${id}`)
  return data.video
}

export { getVideo, getVideos }
