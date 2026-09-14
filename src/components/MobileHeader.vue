<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { useTemplateRef } from 'vue'
import { useHeaderSearch } from '@/composables/useHeaderSearch'

const sinfo = useTemplateRef<HTMLInputElement>('sinfo')
const {
  onSearchInput,
  search,
  searchModeButtonText,
  searchPlaceholder,
  showRollingPlaceholder,
  toggleSearchMode,
} = useHeaderSearch(sinfo)
</script>

<template>
  <div class="site-header">
    <form class="search" @submit.prevent="search">
      <label class="search-input-wrap" for="sinfo">
        <Icon icon="tabler:search" class="search-icon" width="16" height="16" aria-hidden="true" />
        <input
          id="sinfo"
          ref="sinfo"
          name="sinfo"
          class="search-input"
          @input="onSearchInput"
        >
        <button
          type="button"
          class="search-mode-toggle search-mode-toggle--in-field"
          @click.stop="toggleSearchMode"
        >
          {{ searchModeButtonText }}
        </button>
        <Transition name="hot-query-roll" mode="out-in">
          <span v-if="showRollingPlaceholder" :key="searchPlaceholder" class="rolling-placeholder">
            {{ searchPlaceholder }}
          </span>
        </Transition>
      </label>
    </form>
    <RouterLink
      to="/smart-xiaoqiu"
      class="header-icon header-icon--xiaoqiu"
      aria-label="小秋"
    >
      <Icon icon="tabler:sparkles" width="22" height="22" aria-hidden="true" />
    </RouterLink>
    <RouterLink
      to="/music"
      class="header-icon"
      aria-label="音乐"
    >
      <Icon icon="tabler:music" width="22" height="22" aria-hidden="true" />
    </RouterLink>
  </div>
</template>

<style lang="scss" scoped>
.site-header {
  display: flex;
  flex-shrink: 0;
  min-height: var(--layout-nav-h, 2.75rem);
  height: var(--layout-nav-h, 2.75rem);
  background: var(--color-card, #fff);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-text);
  align-items: center;
  padding: 0 12px;
  gap: 10px;
  box-shadow: none;
  overflow: visible;

  .search {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;

    .search-input-wrap {
      --search-toggle-w: 3.6em;
      flex: 1;
      min-width: 0;
      position: relative;
      display: flex;
      align-items: center;
      height: 36px;
      background: var(--color-button-bg-secondary, #f1f3f5);
      border-radius: 999px;
      padding: 0 10px;
      gap: 6px;
    }

    .search-icon {
      flex-shrink: 0;
      color: var(--color-text-muted);
    }

    .search-input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      padding-right: calc(var(--search-toggle-w) + 4px);
      font-size: 14px;
      border: none;
      background: transparent;
      color: var(--color-text);
      line-height: 1;

      &:focus {
        outline: none;
      }

      &::placeholder {
        color: var(--color-text-muted);
      }
    }

    .search-mode-toggle--in-field {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      height: 24px;
      padding: 0 8px;
      border: none;
      border-radius: 999px;
      background: var(--color-card, #fff);
      color: var(--color-text-secondary);
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--color-hover);
      }
    }

    .rolling-placeholder {
      position: absolute;
      left: 36px;
      right: calc(var(--search-toggle-w) + 16px);
      top: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      overflow: hidden;
      color: var(--color-text-muted);
      font-size: 14px;
      line-height: 1;
      white-space: nowrap;
      text-overflow: ellipsis;
      pointer-events: none;
    }
  }
}

.header-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full, 9999px);
  transition: background 0.15s;
  color: var(--color-text);

  &:hover {
    background: var(--color-button-bg-secondary, #f1f3f5);
  }
}

.header-icon--xiaoqiu {
  color: #0ea5e9;
}

.hot-query-roll-enter-active,
.hot-query-roll-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.hot-query-roll-enter-from {
  opacity: 0;
  transform: translateY(55%);
}

.hot-query-roll-leave-to {
  opacity: 0;
  transform: translateY(-55%);
}

.dark-mode .site-header {
  background: var(--color-card);
  color: var(--color-text);

  .search .search-input {
    background: transparent;
    color: var(--color-text);
  }

  .search .rolling-placeholder {
    color: var(--color-text-muted);
  }

  .search .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .search .search-mode-toggle--in-field {
    background: var(--color-bg);
    color: var(--color-text-secondary);
  }
}

body.dark-mode .header-icon--xiaoqiu {
  color: #38bdf8;
}
</style>
