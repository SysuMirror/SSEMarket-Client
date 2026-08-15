import type { Partitions } from '@/store/postStore'
import { ref } from 'vue'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'

export function usePostView() {
  const { userInfo } = useUserStore()
  const { posts, addPost, changeTo, refreshPosts, updateNum } = usePostStore()
  const hasMore = ref(true)
  const isLoading = ref(false)

  async function update() {
    if (isLoading.value || !hasMore.value)
      return
    isLoading.value = true
    try {
      const more = await addPost(userInfo.phone)
      if (!more)
        hasMore.value = false
    }
    finally {
      isLoading.value = false
    }
  }

  async function initialize(categoryName?: typeof Partitions[number], hooks?: { beforeRefresh?: () => void, afterRefresh?: () => void }) {
    if (hooks?.beforeRefresh)
      hooks.beforeRefresh()
    hasMore.value = true
    refreshPosts()
    if (categoryName)
      changeTo(categoryName)
    if (hooks?.afterRefresh)
      hooks.afterRefresh()
    await updateNum(userInfo.phone)
    await update()
  }

  return {
    posts,
    hasMore,
    isLoading,
    update,
    initialize,
  }
}
