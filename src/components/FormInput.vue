<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})
const info = defineModel({
  type: String,
  required: true,
})
</script>

<template>
  <div class="field">
    <input
      v-model="info"
      class="field__input peer"
      v-bind="$attrs"
      required
    >
    <div class="field__line" />
    <label
      class="field__label input-label pointer-events-none"
      :for="$attrs.id as string"
    >{{ $attrs.label }}</label>
  </div>
</template>

<style scoped lang="scss">
.field {
  position: relative;
  margin-bottom: 1.25rem;
  min-height: 2.75rem;
  width: 100%;
}

.field__input {
  height: 2.75rem;
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--chat-border-strong);
  border-radius: 0;
  background: transparent;
  font-size: 1rem;
  color: var(--chat-text);
  padding: 0.5rem 0 0.25rem;
  outline: none;
  transition: border-color 0.2s ease;
}

.field__input:focus {
  border-bottom-color: transparent;
}

.field__input::placeholder {
  color: transparent;
}

.field__line {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: var(--chat-accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.25s ease;
}

.field__input:focus ~ .field__line,
.field__input:valid ~ .field__line {
  transform: scaleX(1);
}

.field__label {
  position: absolute;
  left: 0;
  bottom: 0.625rem;
  font-size: 1rem;
  color: var(--chat-text-tips);
  transition:
    transform 0.2s ease,
    font-size 0.2s ease,
    color 0.2s ease,
    font-weight 0.2s ease;
}

.field__input:focus ~ .field__label,
.field__input:valid ~ .field__label {
  transform: translateY(-1.35rem) scale(0.85);
  transform-origin: left top;
  color: var(--chat-accent);
  font-weight: 500;
  font-size: 0.875rem;
}

.peer:-webkit-autofill ~ .field__line {
  transform: scaleX(1);
}

.peer:-webkit-autofill ~ .field__label {
  transform: translateY(-1.35rem) scale(0.85);
  transform-origin: left top;
  color: var(--chat-accent);
  font-weight: 500;
  font-size: 0.875rem;
}
</style>
