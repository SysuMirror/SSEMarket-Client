import type { ResumeItem } from './types'
import { requestFunc } from '../req'

export async function getResumes(searchsort: 'home' | 'my', searchinfo = ''): Promise<ResumeItem[]> {
  try {
    const res = await requestFunc('/auth/resume/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        searchinfo,
        searchsort,
        limit: 200,
        offset: 0,
      },
    }, true)
    if (!res?.ok)
      return []
    return await res.json() as ResumeItem[]
  }
  catch (e) {
    console.error(e)
    return []
  }
}
