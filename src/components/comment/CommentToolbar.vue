<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    replyOpen?: boolean
    subCount?: number
    subOpen?: boolean
    showSubToggle?: boolean
    replyLabel?: string
    inline?: boolean
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

const slots = useSlots()
const hasLeading = computed(() => !!slots.leading)

const subLabel = computed(() => {
  if (props.subOpen)
    return '收起'
  if (props.subCount > 0)
    return `展开(${props.subCount})`
  return '展开'
})
</script>

<template>
  <div
    class="comment-toolbar"
    :class="{
      'comment-toolbar--inline': inline,
      'comment-toolbar--reply-end': replyAlignEnd,
      'comment-toolbar--split': replyAlignEnd && hasLeading,
    }"
    role="toolbar"
    aria-label="评论操作"
  >
    <slot name="leading" />
    <div class="comment-toolbar__actions">
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
      <slot name="extra" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.comment-toolbar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--chat-border);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.comment-toolbar--inline {
  margin-top: 4px;
  padding-top: 0;
  border-top: none;
}

.comment-toolbar--split {
  width: 100%;
  justify-content: space-between;
}

.comment-toolbar--reply-end:not(.comment-toolbar--split) {
  justify-content: flex-end;
}

.comment-toolbar__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.comment-toolbar--split .comment-toolbar__actions {
  margin-left: auto;
  flex: 0 1 auto;
}

.comment-toolbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  max-width: none;
  min-height: 26px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--chat-border);
  background: transparent;
  color: var(--chat-text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.25;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
  }

  &--active {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
    font-weight: 600;
  }

  &--sub {
    margin-left: 0;
  }
}

.comment-toolbar--inline .comment-toolbar__actions {
  width: 100%;
}

:slotted(.comment-toolbar__link-muted) {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  color: var(--chat-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: var(--chat-accent);
    text-decoration: underline;
  }
}

:slotted(.comment-toolbar__link-vote) {
  padding: 5px 11px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg);

  &:hover {
    text-decoration: none;
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft);
  }
}
</style>
