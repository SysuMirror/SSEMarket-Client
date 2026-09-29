import { Upload } from 'tus-js-client'
import { useUserStore } from '@/store/userStore'

const apiUrl = import.meta.env.VITE_API_BASE_URL

// 与图床 resumable 配置对齐：单文件上限 150MB、分片 2MB
const MAX_ATTACHMENT_BYTES = 150 * 1024 * 1024
const CHUNK_BYTES = 2 * 1024 * 1024
// 凭证到期前提前续签的余量（毫秒），避免慢网下请求进行中凭证过期
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000

export interface FileInfo {
  fileURL: string
  fileName?: string
  message: string
}

interface UploadCredential {
  token: string
  expiresIn: number
  endpoint: string
}

// 在传任务登记：页面卸载/取消时统一终止（abort(true) 会向图床 DELETE 会话，触发分片回收）
const activeUploads = new Set<Upload>()

export function abortActiveUploads(): void {
  for (const upload of activeUploads) {
    upload.abort(true).catch(() => {})
  }
  activeUploads.clear()
}

if (typeof window !== 'undefined') {
  // 页面关闭/刷新时尽力终止在传会话；未完成的由图床 4h GC 兜底
  window.addEventListener('beforeunload', () => abortActiveUploads())
}

async function uploadPhoto(photo: File): Promise<FileInfo> {
  const token = useUserStore().token.value
  if (!token) {
    throw new Error('Authentication token is missing.')
  }
  const formData = new FormData()

  if (photo instanceof File) {
    formData.append('file', photo, photo.name)
  }
  else {
    console.error('Invalid file object:', photo)
    throw new Error('Invalid file object')
  }

  try {
    const response = await fetch(`${apiUrl}/auth/uploadPhotos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  }
  catch (error) {
    console.error('Error uploading photo:', error)
    throw error
  }
}

/** 向主站换取一张短期上传凭证（前端直连图床 tus 用） */
async function fetchUploadCredential(mainToken: string): Promise<UploadCredential> {
  const response = await fetch(`${apiUrl}/auth/uploadAttachment/credential`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mainToken}` },
  })
  if (!response.ok) {
    throw new Error(`获取上传凭证失败（HTTP ${response.status}）`)
  }
  const data = await response.json()
  if (!data || typeof data.token !== 'string' || typeof data.endpoint !== 'string') {
    throw new Error('获取上传凭证失败：响应缺少 token/endpoint')
  }
  return {
    token: data.token,
    expiresIn: typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600,
    endpoint: data.endpoint,
  }
}

/** 使用 tus 直连图床分片上传，返回最终对象直链；凭证过期时自动续签并续传 */
function tusUpload(file: File, credential: UploadCredential, mainToken: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let currentToken = credential.token
    let tokenExpiresAt = Date.now() + credential.expiresIn * 1000
    let forceRefresh = false
    let objectURL = ''

    const refreshCredential = async (): Promise<void> => {
      const fresh = await fetchUploadCredential(mainToken)
      currentToken = fresh.token
      tokenExpiresAt = Date.now() + fresh.expiresIn * 1000
    }

    // 每个请求前确保凭证有效：临近过期主动续签；401 后由 forceRefresh 强制换证
    const ensureFreshToken = async (): Promise<string> => {
      if (!forceRefresh && Date.now() < tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
        return currentToken
      }
      forceRefresh = false
      await refreshCredential()
      return currentToken
    }

    const upload = new Upload(file, {
      endpoint: credential.endpoint,
      chunkSize: CHUNK_BYTES,
      metadata: { filename: file.name },
      retryDelays: [0, 1000, 3000, 5000, 10000],
      // 不落 localStorage 指纹，避免陈旧指纹误导续传；进程内重试/续签仍有效
      storeFingerprintForResuming: false,
      onBeforeRequest: async (req) => {
        req.setHeader('Authorization', `Bearer ${await ensureFreshToken()}`)
      },
      onAfterResponse: (_req, res) => {
        const url = res.getHeader('X-Object-URL')
        if (url)
          objectURL = url
      },
      onShouldRetry: (error) => {
        const status = error.originalResponse?.getStatus() ?? 0
        if (status === 401) {
          forceRefresh = true // 凭证过期：允许重试，重试前 onBeforeRequest 换证
          return true
        }
        // 沿用 tus 默认策略：网络错误 / 409 / 423 / 5xx 可重试
        const retriable = status === 0 || status === 409 || status === 423 || status >= 500
        return retriable && (typeof navigator === 'undefined' || navigator.onLine !== false)
      },
      onSuccess: (payload) => {
        if (!objectURL)
          objectURL = payload.lastResponse.getHeader('X-Object-URL') ?? ''
        activeUploads.delete(upload)
        if (!objectURL) {
          reject(new Error('上传完成但未返回文件地址'))
          return
        }
        resolve(objectURL)
      },
      onError: (error) => {
        activeUploads.delete(upload)
        reject(error)
      },
    })

    activeUploads.add(upload)
    upload.start()
  })
}

/** 通用文件上传（附件，tus 断点续传），返回文件 URL */
async function uploadFile(file: File): Promise<FileInfo> {
  const mainToken = useUserStore().token.value
  if (!mainToken) {
    throw new Error('Authentication token is missing.')
  }
  if (!(file instanceof File)) {
    throw new Error('Invalid file object')
  }
  // 前置校验：与图床侧规则对齐，空文件/超限文件直接拦截，不发起上传会话
  if (file.size === 0) {
    throw new Error('不能上传空文件')
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('文件大小不能超过 150MB')
  }

  const credential = await fetchUploadCredential(mainToken)
  const fileURL = await tusUpload(file, credential, mainToken)

  return { fileURL, fileName: file.name, message: '上传成功' }
}

export { uploadFile, uploadPhoto }
