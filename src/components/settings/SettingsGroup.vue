<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="settings-group">
    <p class="settings-group__title">{{ title }}</p>
    <div class="settings-group__card">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings-group {
  margin-top: 18px;

  &__title {
    margin: 0 0 6px 4px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  &__card {
    background: var(--color-card);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--color-card-shadow);
  }
}
</style>
