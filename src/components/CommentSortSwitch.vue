<script setup lang="ts">
export type CommentTimeOrder = 'desc' | 'asc'

const order = defineModel<CommentTimeOrder>({ default: 'desc' })

function pick(value: CommentTimeOrder) {
  order.value = value
}
</script>

<template>
  <div class="sort-switch" role="group" aria-label="评论排序">
    <span
      class="sort-switch__opt"
      :class="{ 'sort-switch__opt--active': order === 'desc' }"
      role="button"
      tabindex="0"
      @click="pick('desc')"
      @keydown.enter="pick('desc')"
    >最新</span>
    <span
      class="sort-switch__opt"
      :class="{ 'sort-switch__opt--active': order === 'asc' }"
      role="button"
      tabindex="0"
      @click="pick('asc')"
      @keydown.enter="pick('asc')"
    >最早</span>
  </div>
</template>

<style scoped lang="scss">
.sort-switch {
  flex: 0 0 auto;
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--chat-bg-muted, #f0f2f5);
  border-radius: 8px;
  white-space: nowrap;
}

.sort-switch__opt {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--hp-muted, #8a9199);
  white-space: nowrap;
  user-select: none;

  &--active {
    background: var(--hp-card, #fff);
    color: var(--chat-accent, #e85d04);
    font-weight: 600;
  }
}
</style>
