<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { toggleWatchPost } from '@/api/watch/watch'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const props = withDefaults(
  defineProps<{
    postID: number
    watched?: boolean
    /** muted：信息流；prominent：描边药丸；bar：详情页操作条（图标+文字竖排） */
    variant?: 'muted' | 'prominent' | 'bar'
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
      variant === 'prominent'
        ? 'watch-link--prominent'
        : variant === 'bar'
          ? 'watch-link--bar'
          : 'watch-link--muted',
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
    <Icon
      v-if="variant === 'bar'"
      class="watch-link__icon"
      :icon="isWatched ? 'tabler:bell-filled' : 'tabler:bell'"
      width="22"
      height="22"
      aria-hidden="true"
    />
    <span :class="variant === 'bar' ? 'watch-link__label' : ''">{{ label }}</span>
  </button>
</template>
