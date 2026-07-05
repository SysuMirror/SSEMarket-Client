import type { PostDraftPayload } from '@/composables/useOpsAgentStream'
import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'

const apiUrl = import.meta.env.VITE_API_BASE_URL

export interface DraftSubmitResult {
  ok: boolean
  postId?: number
  productId?: number
  url?: string
  error?: string
}

/**
 * 上传图片到主站，返回图片 URL。复用 /api/auth/uploadPhotos 接口。
 */
export async function uploadDraftImage(file: File): Promise<string | null> {
  const token = useUserStore().token.value
  if (!token)
    return null
  const formData = new FormData()
  formData.append('file', file, file.name)
  try {
    const res = await fetch(`${apiUrl}/auth/uploadPhotos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok)
      return null
    const data = await res.json() as { fileURL?: string, message?: string }
    return data.fileURL || null
  }
  catch {
    return null
  }
}

/**
 * 提交草稿到主站。根据 type 调用不同接口：
 * - type=post → POST /api/auth/post
 * - type=product → POST /api/auth/postProduct
 */
export async function submitDraft(
  draft: PostDraftPayload,
  photos: string[] = [],
): Promise<DraftSubmitResult> {
  const userStore = useUserStore()

  if (draft.type === 'product') {
    return submitProduct(draft, photos, userStore.userInfo.userID)
  }
  return submitPost(draft, photos, userStore.userInfo.phone)
}

async function submitPost(
  draft: PostDraftPayload,
  photos: string[],
  userTelephone: string,
): Promise<DraftSubmitResult> {
  if (!userTelephone)
    return { ok: false, error: '用户手机号缺失，请重新登录' }
  try {
    const res = await requestFunc('/auth/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: draft.content,
        partition: draft.partition || '',
        photos: photos.join('|'),
        tagList: (draft.tags || []).join('|'),
        title: draft.title,
        userTelephone,
        isPrivate: draft.is_private ?? false,
      },
    }, true)
    if (!res?.ok)
      return { ok: false, error: `HTTP ${res?.status || '?'}` }
    const data = await res.json() as {
      code?: number
      msg?: string
      data?: { postID?: number }
      postID?: number
    }
    if (data.code !== undefined && data.code !== 200)
      return { ok: false, error: data.msg || `code ${data.code}` }
    const postId = data.data?.postID ?? data.postID ?? 0
    return {
      ok: true,
      postId: typeof postId === 'number' ? postId : undefined,
      url: postId ? `/postdetail/${postId}` : undefined,
    }
  }
  catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

async function submitProduct(
  draft: PostDraftPayload,
  photos: string[],
  userID: number,
): Promise<DraftSubmitResult> {
  if (!userID)
    return { ok: false, error: '用户 ID 缺失，请重新登录' }
  try {
    const res = await requestFunc('/auth/postProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        UserID: userID,
        Price: Math.round(draft.price || 0),
        Title: draft.title.trim(),
        Content: draft.content.trim(),
        Photos: photos,
        ISAnonymous: draft.is_anonymous ?? false,
        syncFeedPost: true,
      },
    }, true)
    if (!res?.ok)
      return { ok: false, error: `HTTP ${res?.status || '?'}` }
    const data = await res.json() as {
      code?: number
      msg?: string
      data?: { ProductID?: number }
      ProductID?: number
    }
    if (data.code !== undefined && data.code !== 200)
      return { ok: false, error: data.msg || `code ${data.code}` }
    const productId = data.data?.ProductID ?? data.ProductID ?? 0
    return {
      ok: true,
      productId: typeof productId === 'number' ? productId : undefined,
      url: productId ? `/shop/productdetail/${productId}` : undefined,
    }
  }
  catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
