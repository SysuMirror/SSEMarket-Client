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
      class="sort-switch__thumb"
      :class="{ 'sort-switch__thumb--asc': order === 'asc' }"
      aria-hidden="true"
    />
    <button
      type="button"
      class="sort-switch__option"
      :class="{ 'sort-switch__option--active': order === 'desc' }"
      @click="pick('desc')"
    >
      最新
    </button>
    <button
      type="button"
      class="sort-switch__option"
      :class="{ 'sort-switch__option--active': order === 'asc' }"
      @click="pick('asc')"
    >
      最早
    </button>
  </div>
</template>
