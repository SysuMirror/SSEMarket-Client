/**
 * 图片来源的边界工具。
 *
 * 站点里有两类图片，必须严格区分：
 * 1. public/ 内置资源（皮肤、表情等）——相对路径，经 publicAssetURL() 拼 BASE_URL；
 * 2. 用户上传到图床的图片——后端返回绝对 http(s) 地址，原样使用。
 *
 * 用户可填写的地址（如自定义背景）只认第 2 类；相对路径 / data: / blob:
 * 一律不接受，避免把 public 路径存进用户设置、换环境后 404。
 */

const HTTP_URL_RE = /^https?:\/\//i
const MAX_URL_LENGTH = 2048

export function isRemoteImageURL(value: unknown): value is string {
  if (typeof value !== 'string')
    return false
  const url = value.trim()
  if (!url || url.length > MAX_URL_LENGTH || !HTTP_URL_RE.test(url))
    return false
  if (/[\u0000-\u001f\u007f]/.test(url))
    return false
  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.host
  }
  catch {
    return false
  }
}

/**
 * 校验并规范化用户提交的自定义背景地址。
 * 返回 null 表示非法；空字符串返回 ''（表示清除）。
 */
export function normalizeCustomBackgroundURL(value: unknown): string | null {
  if (typeof value !== 'string')
    return null
  const url = value.trim()
  if (!url)
    return ''
  if (!isRemoteImageURL(url))
    return null
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  }
  catch {
    return null
  }
}

/**
 * 展示用户上传图片时用：合法的 http(s) 地址原样返回，否则返回空字符串。
 * 绝不要在这里拼 public 路径——内置图片请直接用 skinAssetURL()。
 */
export function resolveUserImageURL(value: unknown): string {
  return isRemoteImageURL(value) ? value.trim() : ''
}

/** 本地预览（File → objectURL）或图床地址都可以直接给 <img>。 */
export function isPreviewableImageSource(value: unknown): value is string {
  if (typeof value !== 'string')
    return false
  return value.startsWith('blob:') || value.startsWith('data:image/') || isRemoteImageURL(value)
}
