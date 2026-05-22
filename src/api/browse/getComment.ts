import type { Comment } from '@/types/comment'
import { requestFunc } from '../req'

async function getCommentsByPostID(
  PostID: number,
  userTelephone: string,
): Promise<Comment[]> {
  try {
    const res = await requestFunc(
      `/auth/showPcomments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          postID: PostID,
          userTelephone,
          postType: 'post',
        },
      },
      true,
    )
    if (!res!.ok) {
      console.error('获取评论失败:', res!.status, res!.statusText)
      return []
    }

    return await res!.json() as Comment[]
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export { getCommentsByPostID }
