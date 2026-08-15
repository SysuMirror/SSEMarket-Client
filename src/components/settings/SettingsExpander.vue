<script setup lang="ts">
defineProps<{
  label: string
  value?: string
  open: boolean
  hint?: string
}>()
defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <div class="settings-expander">
    <div
      class="settings-expander__header"
      :class="{ 'settings-expander__header--open': open }"
      role="button"
      tabindex="0"
      @click="$emit('update:open', !open)"
      @keydown.enter.prevent="$emit('update:open', !open)"
      @keydown.space.prevent="$emit('update:open', !open)"
    >
      <div class="settings-expander__text">
        <span class="settings-expander__label">{{ label }}</span>
        <span v-if="hint" class="settings-expander__hint">{{ hint }}</span>
      </div>
      <div class="settings-expander__right">
        <span v-if="value" class="settings-expander__value">{{ value }}</span>
        <span class="settings-expander__arrow" :class="{ 'settings-expander__arrow--open': open }" aria-hidden="true">›</span>
      </div>
    </div>
    <div v-if="open" class="settings-expander__body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-expander {
  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-card);
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }

    &--open {
      background: var(--color-hover);
      border-bottom: none;
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__label {
    display: block;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.4;
  }

  &__hint {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    max-width: 60%;
  }

  &__value {
    font-size: 14px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    color: var(--color-text-muted);
    font-size: 14px;
    line-height: 1;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(90deg);
    }
  }

  &__body {
    padding: 14px 16px;
    background: var(--color-card);
    border-top: 1px solid var(--color-border);
  }
}
</style>
