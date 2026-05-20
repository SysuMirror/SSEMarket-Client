<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { checkUserVoted, submitVote } from '@/api/vote/vote'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const props = withDefaults(
  defineProps<{
    postID: number
    /** muted：信息流卡片；prominent：帖子详情 */
    variant?: 'muted' | 'prominent'
  }>(),
  { variant: 'muted' },
)

const emit = defineEmits<{
  voted: []
}>()

const { userInfo } = useUserStore()
const voted = ref(false)
const checking = ref(true)
const submitting = ref(false)

async function loadVotedState() {
  if (!props.postID) {
    checking.value = false
    voted.value = false
    return
  }
  checking.value = true
  try {
    voted.value = await checkUserVoted(props.postID, userInfo.phone)
  }
  catch (e) {
    console.error(e)
    voted.value = false
  }
  finally {
    checking.value = false
  }
}

onMounted(() => {
  void loadVotedState()
})

watch(() => props.postID, () => {
  void loadVotedState()
})

async function handleVote(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (!props.postID || voted.value || submitting.value || checking.value)
    return
  submitting.value = true
  try {
    const { ok, msg } = await submitVote(props.postID, userInfo.phone)
    showMsg(msg)
    if (ok) {
      voted.value = true
      emit('voted')
    }
  }
  catch (e) {
    console.error(e)
    showMsg('投票失败')
  }
  finally {
    submitting.value = false
  }
}

const label = computed(() => {
  if (checking.value)
    return '…'
  if (submitting.value)
    return '提交中'
  if (voted.value)
    return '已投票'
  return '投票'
})
</script>

<template>
  <button
    type="button"
    class="vote-link"
    :class="[
      variant === 'prominent' ? 'vote-link--prominent' : 'vote-link--muted',
      {
        'vote-link--voted': voted,
        'vote-link--busy': checking || submitting,
      },
    ]"
    :disabled="!postID || voted || checking || submitting"
    :aria-pressed="voted"
    @click="handleVote"
  >
    {{ label }}
  </button>
</template>
