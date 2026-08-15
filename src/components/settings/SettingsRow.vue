<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value?: string
    clickable?: boolean
    hint?: string
  }>(),
  {
    clickable: false,
    value: '',
    hint: '',
  },
)
defineEmits<{
  click: []
}>()
</script>

<template>
  <div
    class="settings-row"
    :class="{
      'settings-row--clickable': clickable,
      'settings-row--with-hint': !!hint,
    }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <div class="settings-row__text">
      <span class="settings-row__label">{{ label }}</span>
      <span v-if="hint" class="settings-row__hint">{{ hint }}</span>
    </div>
    <div class="settings-row__right">
      <span v-if="value" class="settings-row__value">{{ value }}</span>
      <span v-if="clickable" class="settings-row__arrow" aria-hidden="true">›</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-card);

  &:last-child {
    border-bottom: none;
  }

  &--clickable {
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }
  }

  &--with-hint {
    align-items: flex-start;
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
  }
}
</style>
