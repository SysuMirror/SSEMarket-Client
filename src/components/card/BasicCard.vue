<template>
  <div class="card-root mx-a flex flex-col">
    <slot />
  </div>
</template>

<style lang="scss">
.card-root {
  position: relative;
  padding: 10px 12px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--chat-border-strong);
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);
  }
}

/* 帖子正文多为 Markdown，不再统一首行缩进，避免与信息流风格冲突 */
.card-root p {
  text-indent: 0;
}
</style>
