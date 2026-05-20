export interface ResumeItem {
  resumeID: number
  userID: number
  uploader: string
  title: string
  description: string
  fileName: string
  fileSize: number
  mimeType: string
  fileExt: string
  downloadNum: number
  isAnonymous: boolean
  isOwner: boolean
  canPreview: boolean
  createdAt: string
}

export interface ResumePreviewResult {
  code: number
  data: { fileURL: string, fileName: string, canPreview: boolean }
  msg: string
}

export interface ResumeUploadResult {
  code: number
  data: { resumeID: number }
  msg: string
}

export interface ResumeDownloadResult {
  code: number
  data: { downloadURL: string, fileName: string }
  msg: string
}
