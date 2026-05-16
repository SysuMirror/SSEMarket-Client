import type { Post } from '@/types/post'
import { requestFunc } from '../req'

export interface UserProfilePostsParams {
  userTelephone: string
  targetUserID: number
  limit: number
  offset: number
}

export async function getUserProfilePosts(params: UserProfilePostsParams): Promise<Post[]> {
  try {
    const res = await requestFunc(
      '/auth/userProfilePosts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: params,
      },
      true,
    )
    if (!res?.ok) {
      return []
    }
    return await res.json()
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export async function getUserProfilePostNum(userTelephone: string, targetUserID: number): Promise<number> {
  try {
    const res = await requestFunc(
      '/auth/userProfilePostNum',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { userTelephone, targetUserID },
      },
      true,
    )
    if (!res?.ok) {
      return 0
    }
    const data = await res.json()
    return typeof data.Postcount === 'number' ? data.Postcount : 0
  }
  catch (e) {
    console.error(e)
    return 0
  }
}
