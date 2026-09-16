import { useUserStore } from '@/store/userStore'

const apiUrl = import.meta.env.VITE_API_BASE_URL

export interface FileInfo {
  fileURL: string
  fileName?: string
  message: string
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

/** 通用文件上传（使用附件接口），返回文件 URL */
async function uploadFile(file: File): Promise<FileInfo> {
  const token = useUserStore().token.value
  if (!token) {
    throw new Error('Authentication token is missing.')
  }
  const formData = new FormData()

  if (file instanceof File) {
    formData.append('file', file, file.name)
  }
  else {
    console.error('Invalid file object:', file)
    throw new Error('Invalid file object')
  }

  try {
    const response = await fetch(`${apiUrl}/auth/uploadAttachment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
    }

    const data = await response.json()
    return data
  }
  catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export { uploadFile, uploadPhoto }
