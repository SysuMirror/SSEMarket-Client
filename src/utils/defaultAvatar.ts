const DEFAULT_AVATAR_COUNT = 10

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** 空头像/加载失败时的兜底：按 userID 哈希稳定映射到内置的 10 张默认头像 */
export function defaultAvatarFor(userId: number | string | null | undefined): string {
  const n = Number(userId)
  const id = Number.isFinite(n) && n > 0 ? n : 0
  const idx = fnv1a32(String(id)) % DEFAULT_AVATAR_COUNT
  return `${import.meta.env.BASE_URL}default-avatars/${idx + 1}.jpg`
}
