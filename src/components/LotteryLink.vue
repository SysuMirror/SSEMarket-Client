<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { participateLottery } from '@/api/lottery/lottery'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const props = withDefaults(
  defineProps<{
    postID: number
    participated?: boolean
    disabled?: boolean
    variant?: 'muted' | 'prominent'
  }>(),
  { participated: false, disabled: false, variant: 'prominent' },
)

const emit = defineEmits<{
  participated: []
}>()

const { userInfo } = useUserStore()
const joined = ref(props.participated)
const submitting = ref(false)

watch(() => props.participated, (v) => {
  joined.value = v
})

async function handleParticipate(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (!props.postID || joined.value || submitting.value || props.disabled)
    return
  submitting.value = true
  try {
    const { ok, msg } = await participateLottery(props.postID, userInfo.phone)
    showMsg(msg)
    if (ok) {
      joined.value = true
      emit('participated')
    }
  }
  catch (e) {
    console.error(e)
    showMsg('参与失败')
  }
  finally {
    submitting.value = false
  }
}

const label = computed(() => {
  if (submitting.value)
    return '提交中…'
  if (joined.value)
    return '已参与'
  return '参与抽奖'
})

onMounted(() => {
  joined.value = props.participated
})
</script>

<template>
  <button
    type="button"
    class="lottery-link"
    :class="[
      variant === 'prominent' ? 'lottery-link--prominent' : 'lottery-link--muted',
      {
        'lottery-link--joined': joined,
        'lottery-link--busy': submitting,
      },
    ]"
    :disabled="!postID || joined || submitting || disabled"
    :aria-pressed="joined"
    @click="handleParticipate"
  >
    <Icon
      v-if="submitting"
      icon="tabler:loader-2"
      class="lottery-link__spin"
      width="16"
      height="16"
    />
    {{ label }}
  </button>
</template>

<style scoped lang="scss">
.lottery-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: none;
  font-family: inherit;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
  appearance: none;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:disabled {
    cursor: default;
    opacity: 0.72;
  }

  &--busy {
    pointer-events: none;
  }
}

.lottery-link--muted {
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 500;
  color: var(--chat-text-secondary);
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg);

  &:hover:not(:disabled) {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
  }
}

.lottery-link--prominent {
  padding: 7px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--chat-unread-text);
  background: var(--chat-accent);
  border: 1px solid var(--chat-accent);
  border-radius: 8px;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
}

.lottery-link--joined.lottery-link--prominent,
.lottery-link--joined.lottery-link--muted {
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border-color: var(--chat-border);
  filter: none;
}

.lottery-link__spin {
  animation: lottery-link-spin 0.8s linear infinite;
}

@keyframes lottery-link-spin {
  to { transform: rotate(360deg); }
}
</style>
