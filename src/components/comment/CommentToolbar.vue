<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    replyOpen?: boolean
    subCount?: number
    subOpen?: boolean
    showSubToggle?: boolean
    replyLabel?: string
    /** 与帖子操作栏同一行（评分帖等） */
    inline?: boolean
    /** 主操作按钮靠右（如「写评论」） */
    replyAlignEnd?: boolean
  }>(),
  {
    replyOpen: false,
    subCount: 0,
    subOpen: false,
    showSubToggle: true,
    replyLabel: '回复',
    inline: false,
    replyAlignEnd: false,
  },
)

const emit = defineEmits<{
  'toggle-reply': []
  'toggle-sub': []
}>()

const subLabel = computed(() => {
  if (props.subOpen)
    return '收起回复'
  if (props.subCount > 0)
    return `展开 ${props.subCount} 条回复`
  return '展开回复'
})
</script>

<template>
  <div
    class="comment-toolbar"
    :class="{
      'comment-toolbar--inline': inline,
      'comment-toolbar--reply-end': replyAlignEnd,
    }"
    role="toolbar"
    aria-label="评论操作"
  >
    <button
      type="button"
      class="comment-toolbar__btn"
      :class="{ 'comment-toolbar__btn--active': replyOpen }"
      :aria-expanded="replyOpen"
      @click="emit('toggle-reply')"
    >
      {{ replyOpen ? '收起' : replyLabel }}
    </button>
    <button
      v-if="showSubToggle && subCount > 0"
      type="button"
      class="comment-toolbar__btn comment-toolbar__btn--sub"
      :class="{ 'comment-toolbar__btn--active': subOpen }"
      :aria-expanded="subOpen"
      @click="emit('toggle-sub')"
    >
      {{ subLabel }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.comment-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--chat-border);
}

.comment-toolbar--inline {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.comment-toolbar--reply-end {
  justify-content: flex-end;
}

.comment-toolbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  min-height: 34px;
  padding: 6px 20px;
  border-radius: 8px;
  border: 1px solid var(--chat-accent);
  background: var(--chat-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
    background: var(--chat-accent);
    border-color: var(--chat-accent);
    color: #fff;
  }

  &--active {
    background: #1e2a3d;
    border-color: #1e2a3d;
    color: #fff;
  }

  &--sub {
    margin-left: auto;
  }
}

.comment-toolbar--inline .comment-toolbar__btn--sub {
  margin-left: 0;
}

.comment-toolbar--reply-end .comment-toolbar__btn--sub {
  margin-left: 8px;
}
</style>
