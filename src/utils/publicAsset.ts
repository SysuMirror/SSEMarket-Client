/**
 * public/ 静态资源 URL 解析。
 *
 * 部署可能在子路径（Vite BASE_URL 不以 / 结尾时也兜住），
 * 所有 public 内置图片都必须经过这里；用户上传的图床图片是绝对地址，
 * 不要用这个函数拼接。
 */
export function publicAssetURL(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${path.replace(/^\/+/, '')}`
}
