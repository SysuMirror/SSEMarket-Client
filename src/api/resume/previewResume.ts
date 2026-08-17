import { useUserStore } from '@/store/userStore'
import { ensureAccessToken } from '../req'

const apiUrl = import.meta.env.VITE_API_BASE_URL

async function fetchPreviewResponse(resumeID: number): Promise<Response | null> {
  const ok = await ensureAccessToken()
  if (!ok)
    return null

  const token = useUserStore().token.value
  if (!token)
    return null

  const res = await fetch(`${apiUrl}/auth/resume/preview/stream/${resumeID}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok)
    return null
  return res
}

/** 拉取 PDF 二进制数据，供 pdf.js 在 canvas 上渲染（兼容微信内置浏览器）。 */
export async function fetchResumePreviewArrayBuffer(resumeID: number): Promise<ArrayBuffer | null> {
  const res = await fetchPreviewResponse(resumeID)
  if (!res)
    return null
  return res.arrayBuffer()
}

/** 拉取预览 Blob，供图片等格式页内展示。 */
export async function fetchResumePreviewBlob(resumeID: number): Promise<Blob | null> {
  const res = await fetchPreviewResponse(resumeID)
  if (!res)
    return null
  return res.blob()
}

export const RESUME_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const

export function isResumeImageExt(ext?: string): boolean {
  if (!ext)
    return false
  return RESUME_IMAGE_EXTS.includes(ext.toLowerCase() as typeof RESUME_IMAGE_EXTS[number])
}

export function isWeChatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent)
}
