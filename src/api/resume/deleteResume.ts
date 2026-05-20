import { requestFunc } from '../req'

export async function deleteResume(resumeID: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/resume/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { resumeID },
    }, true)
    if (!res?.ok)
      return false
    const data = await res.json() as { code: number }
    return data.code === 200
  }
  catch (e) {
    console.error(e)
    return false
  }
}
