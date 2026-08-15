import type { ComputedRef, Ref } from 'vue'
import { ref, unref, watch } from 'vue'
import { resolveMentionUsers } from '@/api/mention/mention'
import { parseMentionTokens } from '@/utils/mention'

const globalCache = new Map<string, number>()

export function useMentionResolve(content: Ref<string> | ComputedRef<string>) {
  const nameToUserId = ref<Record<string, number>>({})

  watch(
    content,
    async (text) => {
      const names = parseMentionTokens(text ?? '')
      if (names.length === 0) {
        nameToUserId.value = {}
        return
      }
      const map: Record<string, number> = {}
      const missing: string[] = []
      for (const name of names) {
        const cached = globalCache.get(name)
        if (cached && cached > 0) {
          map[name] = cached
        }
        else {
          missing.push(name)
        }
      }
      if (missing.length > 0) {
        try {
          const users = await resolveMentionUsers(missing)
          for (const u of users) {
            if (u.userID > 0 && u.name) {
              globalCache.set(u.name, u.userID)
              map[u.name] = u.userID
            }
          }
        }
        catch (e) {
          console.error('resolveMentionUsers failed', e)
        }
      }
      nameToUserId.value = map
    },
    { immediate: true },
  )

  return nameToUserId
}

export function primeMentionCache(name: string, userId: number) {
  const n = name.trim()
  if (n && userId > 0)
    globalCache.set(n, userId)
}

export function getMentionUserId(name: string): number | undefined {
  return globalCache.get(name.trim())
}

export function useMentionResolveOnce(content: string) {
  return unref(useMentionResolve(ref(content)))
}
