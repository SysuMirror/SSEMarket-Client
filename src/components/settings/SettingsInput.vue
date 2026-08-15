<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    modelValue: string
    type?: string
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'none'
  }>(),
  {
    type: 'text',
    placeholder: '',
    autocomplete: 'off',
    inputmode: 'text',
  },
)
defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="settings-input">
    <span class="settings-input__label">{{ label }}</span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      class="settings-input__field"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </label>
</template>

<style scoped lang="scss">
.settings-input {
  display: block;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &__label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  &__field {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-card);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
  }
}
</style>
