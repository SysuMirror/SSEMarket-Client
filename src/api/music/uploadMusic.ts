import { useUserStore } from '@/store/userStore'

const apiUrl = import.meta.env.VITE_API_BASE_URL

export interface MusicSummary {
  musicID: number
  title: string
  artist: string
  album: string
  format: string
  durationSec: number
  sizeBytes: number
  playCount: number
  hasCover: boolean
  uploaderID: number
  uploaderName: string
  isOwner: boolean
  postTime: string
}

/**
 * @description 浏览器读取本地音频时长（上传前预读，服务端免去按格式解码）
 */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const d = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0
      URL.revokeObjectURL(url)
      resolve(d)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取音频信息，请确认文件完好'))
    }
    audio.src = url
  })
}

/**
 * @description XHR 上传音乐（fetch 无法监听上传进度，大文件上传用 XHR 是成熟做法）
 * 两段式第一步：服务端保存并解析元数据/内嵌封面，返回预览信息（未发布）
 */
export function uploadMusic(
  file: File,
  duration: number,
  onProgress?: (percent: number) => void,
): Promise<MusicSummary> {
  return new Promise((resolve, reject) => {
    const token = useUserStore().token.value
    if (!token) {
      reject(new Error('登录过期，请重新登录'))
      return
    }
    const formData = new FormData()
    formData.append('file', file, file.name)
    formData.append('duration', String(duration))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiUrl}/auth/uploadMusic`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText)
        if (xhr.status === 200 && res.code === 200 && res.data?.music) {
          resolve(res.data.music as MusicSummary)
        }
        else {
          reject(new Error(res.msg || '上传失败'))
        }
      }
      catch {
        reject(new Error('上传失败：服务端响应异常'))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.send(formData)
  })
}
