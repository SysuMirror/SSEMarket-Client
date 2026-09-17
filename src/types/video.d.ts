export type VideoSourceType = 'bilibili' | 'mp4' | 'hls'

export interface PublicVideo {
  videoID: number
  title: string
  description: string
  coverURL: string
  sourceType: VideoSourceType
  sourceURL: string
  bilibiliBVID: string
  externalPageURL: string
  durationSec: number
  playCount: number
  publishedAt: string | null
}
