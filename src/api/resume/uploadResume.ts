import type { ResumeUploadResult } from './types'
import { useUserStore } from '@/store/userStore'

const apiUrl = import.meta.env.VITE_API_BASE_URL

export async function uploadResume(
  file: File,
  title: string,
  description: string,
  isAnonymous: boolean,
): Promise<ResumeUploadResult> {
  const token = useUserStore().token.value
  if (!token)
    throw new Error('请先登录')

  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('title', title)
  formData.append('description', description)
  formData.append('isAnonymous', isAnonymous ? 'true' : 'false')

  const response = await fetch(`${apiUrl}/auth/resume/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  const data = await response.json() as ResumeUploadResult
  if (!response.ok || data.code !== 200)
    throw new Error(data.msg || '上传失败')
  return data
}
