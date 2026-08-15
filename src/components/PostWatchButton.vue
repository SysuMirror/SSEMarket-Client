<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toggleWatchPost } from '@/api/watch/watch'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const props = withDefaults(
  defineProps<{
    postID: number
    watched?: boolean
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
    @click="handleToggle"
  >
    {{ label }}
  </button>
</template>
