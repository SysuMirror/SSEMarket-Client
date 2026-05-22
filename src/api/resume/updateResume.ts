import type { ResumeItem } from './types'
import { requestFunc } from '../req'

export async function updateResume(
  resumeID: number,
  title: string,
  description: string,
): Promise<ResumeItem | null> {
  try {
    const res = await requestFunc('/auth/resume/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { resumeID, title, description },
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
