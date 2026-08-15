<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    hint?: string
    modelValue: boolean
    disabled?: boolean
  }>(),
  {
    hint: '',
    disabled: false,
  },
)
defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div class="settings-toggle">
    <div class="settings-toggle__text">
      <span class="settings-toggle__title">{{ title }}</span>
      <span v-if="hint" class="settings-toggle__hint">{{ hint }}</span>
    </div>
    <button
      type="button"
      class="settings-toggle__switch"
      :class="{ 'settings-toggle__switch--on': modelValue }"
      :disabled="disabled"
      role="switch"
      :aria-checked="modelValue"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span class="settings-toggle__knob" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.settings-toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-card);

  &:last-child {
    border-bottom: none;
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__title {
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

  &__switch {
    position: relative;
    flex-shrink: 0;
    width: 38px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 11px;
    background: var(--color-button-bg-secondary);
    cursor: pointer;
    transition: background 0.2s ease;
    -webkit-tap-highlight-color: transparent;

    &--on {
      background: var(--accent);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  &__knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
  }

  &__switch--on &__knob {
    transform: translateX(16px);
  }
}
</style>
