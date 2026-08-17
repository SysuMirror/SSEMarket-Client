<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    replyOpen?: boolean
    subCount?: number
    subOpen?: boolean
    showSubToggle?: boolean
    replyLabel?: string
    /** 帖子详情「写评论」等主操作：略加重描边与底色 */
    replyProminent?: boolean
    inline?: boolean
    replyAlignEnd?: boolean
    /** 紧贴数据栏等上一区块时去掉顶部分割线 */
    noTopBorder?: boolean
  }>(),
  {
    replyOpen: false,
    subCount: 0,
    subOpen: false,
    showSubToggle: true,
    replyLabel: '回复',
    replyProminent: false,
    inline: false,
    replyAlignEnd: false,
    noTopBorder: false,
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
      'comment-toolbar--no-top-border': props.noTopBorder,
    }"
    role="toolbar"
    aria-label="评论操作"
  >
    <slot name="leading" />
    <div class="comment-toolbar__actions">
      <button
        type="button"
        class="comment-toolbar__btn"
        :class="{
          'comment-toolbar__btn--active': replyOpen,
          'comment-toolbar__btn--prominent': replyProminent,
        }"
        :aria-expanded="replyOpen"
        @click.stop="emit('toggle-reply')"
      >
        {{ replyOpen ? '收起' : replyLabel }}
      </button>
      <button
        v-if="showSubToggle && subCount > 0"
        type="button"
        class="comment-toolbar__btn comment-toolbar__btn--sub"
        :class="{ 'comment-toolbar__btn--active': subOpen }"
        :aria-expanded="subOpen"
        @click.stop="emit('toggle-sub')"
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

.comment-toolbar--inline,
.comment-toolbar--no-top-border {
  margin-top: 4px;
  padding-top: 0;
  border-top: none;
}

.comment-toolbar--split {
  width: 100%;
  justify-content: space-between;
  gap: 8px;
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
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
}

.comment-toolbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: auto;
  min-width: 0;
  max-width: none;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--chat-accent);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.25;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    color: var(--chat-accent);
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &--active {
    color: var(--chat-accent);
    background: transparent;
    font-weight: 600;
    text-decoration: none;
  }

  &--sub {
    margin-left: 0;
  }
}

.comment-toolbar--inline:not(.comment-toolbar--split) .comment-toolbar__actions {
  width: 100%;
}
</style>
