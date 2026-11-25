<script setup lang="ts">
import { trackEvia } from '@/analytics/evia'
import { computed, ref, watch } from 'vue'
import { toggleWatchPost } from '@/api/watch/watch'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const props = withDefaults(
  defineProps<{
    postID: number
    watched?: boolean
    /** muted：信息流；prominent：详情页操作行的描边药丸 */
    variant?: 'muted' | 'prominent'
  }>(),
  { watched: false, variant: 'prominent' },
)

const emit = defineEmits<{
  watchedChange: [watched: boolean]
}>()

const { userInfo } = useUserStore()
const isWatched = ref(props.watched)
const submitting = ref(false)

watch(() => props.watched, (v) => {
  isWatched.value = v
})

const label = computed(() => {
  if (submitting.value)
    return '…'
  return isWatched.value ? '已码住' : '码住'
})

async function handleToggle(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (!props.postID || submitting.value)
    return
  submitting.value = true
  try {
    const { ok, msg, watched } = await toggleWatchPost(props.postID, userInfo.phone)
    showMsg(msg)
    if (ok) {
      trackEvia(watched ? 'post_watched' : 'post_watch_cancelled', { post_id: Number(props.postID) })
      isWatched.value = watched
      emit('watchedChange', watched)
    }
  }
  catch (e) {
    console.error(e)
    showMsg('操作失败')
  }
  finally {
    submitting.value = false
    ;(event.currentTarget as HTMLButtonElement | null)?.blur()
  }
}
</script>

<template>
  <button
    type="button"
    class="watch-link"
    :class="[
      variant === 'prominent' ? 'watch-link--prominent' : 'watch-link--muted',
      {
        'watch-link--active': isWatched,
        'watch-link--busy': submitting,
      },
    ]"
    :disabled="!postID || submitting"
    :aria-pressed="isWatched"
    :title="isWatched ? '取消码住' : '码住，更新时提醒我'"
    @click="handleToggle"
  >
    <span>{{ label }}</span>
  </button>
</template>
