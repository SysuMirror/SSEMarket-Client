import { requestFunc } from '../req'

export interface MentionUser {
  name: string
  userID: number
}

async function parseResponse<T>(res: Response): Promise<T | null> {
  const json = await res.json()
  if (!res.ok || json.code !== 200)
    return null
  return json.data as T
}

export async function resolveMentionUsers(names: string[]): Promise<MentionUser[]> {
  if (!names.length)
    return []
  const res = await requestFunc('/auth/resolveMentions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { names },
  }, true)
  if (!res)
    return []
  const data = await parseResponse<{ users: MentionUser[] }>(res)
  if (!data?.users)
    return []
  return data.users.map(u => ({
    name: u.name,
    userID: Number(u.userID) || 0,
  }))
}
