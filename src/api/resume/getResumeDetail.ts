import type { ResumeItem } from './types'
import { requestFunc } from '../req'

export async function getResumeDetail(resumeID: number): Promise<ResumeItem | null> {
  try {
    const res = await requestFunc('/auth/resume/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { resumeID },
    }, true)
    if (!res?.ok)
      return null
    return await res.json() as ResumeItem
  }
  catch (e) {
    console.error(e)
    return null
  }
}
