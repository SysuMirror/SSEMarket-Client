import type { ResumeDownloadResult } from './types'
import { requestFunc } from '../req'

export async function downloadResume(resumeID: number): Promise<{ downloadURL: string, fileName: string } | null> {
  try {
    const res = await requestFunc('/auth/resume/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { resumeID },
    }, true)
    if (!res?.ok)
      return null
    const data = await res.json() as ResumeDownloadResult
    if (data.code !== 200 || !data.data?.downloadURL)
      return null
    return data.data
  }
  catch (e) {
    console.error(e)
    return null
  }
}
