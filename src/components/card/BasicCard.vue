<template>
  <div class="card-root mx-a flex flex-col">
    <slot />
  </div>
</template>

<style lang="scss">
.card-root {
  position: relative;
  padding: 14px;
  background: var(--color-card, #ffffff);
  border: none;
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  transition:
    box-shadow 0.15s ease,
    transform 0.1s ease;

  &:hover {
    box-shadow: var(--color-card-hover-shadow);
  }
}

.card-root p {
  text-indent: 0;
}
</style>
