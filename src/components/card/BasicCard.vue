<template>
  <div class="card-root mx-a flex flex-col">
    <slot />
  </div>
</template>

<style lang="scss">
.card-root {
  position: relative;
  padding: 12px 14px;
  background: var(--color-card, var(--chat-bg-highlight));
  border: 1px solid var(--color-border, var(--chat-border));
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--color-card-shadow);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;

  &:hover {
    border-color: var(--color-border-strong, var(--chat-border-strong));
    box-shadow: var(--color-card-hover-shadow);
  }
}

.card-root p {
  text-indent: 0;
}
</style>
