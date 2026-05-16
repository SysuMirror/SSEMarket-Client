<script setup lang="ts">
import type { CustomFormData } from '@/composables/FormExam'

import FormInput from '@/components/FormInput.vue'

defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  formName: {
    type: String,
    required: false,
    default: '提交',
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false,
  },
  formData: {
    type: Array<CustomFormData>,
    required: true,
  },
})

defineEmits(['submitForm'])
</script>

<template>
  <div class="auth-card">
    <header v-if="title || subtitle" class="auth-card__head">
      <h1 v-if="title" class="auth-card__title">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="auth-card__sub">
        {{ subtitle }}
      </p>
    </header>
    <form class="auth-card__form" @submit.prevent="$emit('submitForm')">
      <FormInput
        v-for="item in formData"
        :id="item.id"
        :key="item.id"
        v-model="item.value"
        :label="item.label"
        :type="item.type || ''"
        :autocomplete="item.autocomplete || 'off'"
      />
      <div class="auth-card__slot">
        <slot />
      </div>
      <button
        :disabled="disabled"
        class="auth-btn auth-btn--primary"
        type="submit"
      >
        {{ disabled ? '请填写完整信息' : formName }}
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.auth-card {
  width: 100%;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 1rem;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 12px 40px rgba(15, 23, 42, 0.08);
  padding: 2rem 1.75rem calc(2.25rem + env(safe-area-inset-bottom, 0px));
}

body.dark-mode .auth-card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 12px 40px rgba(0, 0, 0, 0.45);
}

@media (min-width: 640px) {
  .auth-card {
    padding: 2.25rem 2rem calc(2.5rem + env(safe-area-inset-bottom, 0px));
  }
}

.auth-card__head {
  margin-bottom: 1.75rem;
  text-align: center;
}

.auth-card__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--chat-text);
  line-height: 1.35;
}

.auth-card__sub {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--chat-text-secondary);
}

.auth-card__form {
  margin: 0;
}

.auth-card__slot {
  margin-top: 0.25rem;
}

.auth-btn {
  margin-top: 1.25rem;
  width: 100%;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0.625rem;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  text-transform: none;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    filter 0.2s ease,
    opacity 0.2s ease;
}

.auth-btn--primary {
  background: var(--chat-accent);
  color: var(--chat-unread-text);
}

.auth-btn--primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.auth-btn--primary:disabled {
  background: var(--chat-border-strong);
  color: var(--chat-text-secondary);
  cursor: not-allowed;
  opacity: 0.92;
}
</style>
