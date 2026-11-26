<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { trackEvia } from '@/analytics/evia'

// 主题引导已移至 main.ts（首帧前同步应用）；此处仅负责切换与展示
const mode = ref(document.body.classList.contains('dark-mode') ? 'dark-mode' : 'light-mode')
function changeMode() {
  document.body.classList.toggle('dark-mode')
  mode.value = document.body.classList.contains('dark-mode')
    ? 'dark-mode'
    : 'light-mode'
  localStorage.setItem('mode', mode.value)
  trackEvia('theme_mode_changed', { theme_mode: mode.value === 'dark-mode' ? 'dark' : 'light' })
}
</script>

<template>
  <div
    class="mode-select"
    @click="changeMode"
  >
    <Icon
      v-if="mode === 'dark-mode'"
      icon="material-symbols:dark-mode"
    />
    <Icon
      v-else
      icon="material-symbols:light-mode"
    />
  </div>
</template>

<style scoped lang="scss">
.mode-select {
  color: var(--color-text, #0f172a);
  display: flex;
  align-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mode-select :deep(svg) {
  color: inherit;
  fill: currentColor;
}
</style>
