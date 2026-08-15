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
    <RouterLink
      to="/smart-xiaoqiu"
      class="lesson lesson--xiaoqiu"
      aria-label="智能小秋"
    >
      <Icon icon="tabler:sparkles" width="24" height="24" aria-hidden="true" />
    </RouterLink>
    <form class="search" @submit.prevent="search">
      <label class="search-input-wrap" for="sinfo">
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
      <button type="submit" class="search-submit" aria-label="搜索">
        <Icon icon="tabler:search" width="18" height="18" />
      </button>
    </form>
  </div>
</template>

<style lang="scss" scoped>
.site-header {
  display: flex;
  flex-shrink: 0;
  min-height: var(--layout-nav-h, 2.125rem);
  height: var(--layout-nav-h, 2.125rem);
  background: var(--color-nav-bg, #fffffff2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--color-text);
  align-items: center;
  padding: 0 0.45em;
  box-shadow: 0 1px 3px rgba(71, 85, 105, 0.08);
  overflow: hidden;

  .links {
    a {
      position: relative;
      display: inline-block;
      padding: 0.1em 0.35em;
      font-size: 12px;
      border-radius: 4px;
      margin-right: 0.2em;
      text-decoration: none;
      transition: all 0.15s;
    }

    a:hover,
    .router-link-active {
      background: var(--accent);
      color: #fff !important;
    }

    a:link,
    a:visited {
      color: var(--color-text-secondary);
    }

    .notice-num {
      position: absolute;
      top: -4px;
      right: -3px;
      border-radius: 9px;
      background: var(--color-unread);
      color: #fff;
      height: 1rem;
      text-align: center;
      line-height: 1;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 4px;
      min-width: 1rem;
    }
  }

  .search {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 0.4em;
    margin: 0 0.5em;
    text-align: center;

    .search-input-wrap {
      --search-toggle-w: 4.6em;
      flex: 1;
      min-width: 0;
      width: 100%;
      max-width: 48em;
      height: 1.86em;
      position: relative;
    }

    .search-input,
    input {
      width: 100%;
      height: 100%;
      padding: 0 calc(var(--search-toggle-w) + 0.35em) 0 0.5em;
      font-size: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm, 6px);
      line-height: 0.8;
      vertical-align: middle;
      box-sizing: border-box;
      background: var(--color-card);
      color: var(--color-text);
      transition: border-color 0.15s ease;

      &:focus {
        outline: none;
        border-color: var(--accent);
      }
    }

    .search-mode-toggle--in-field {
      position: absolute;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      height: calc(100% - 4px);
      width: var(--search-toggle-w);
      margin: 0;
      padding: 0 2px;
      border: none;
      border-left: 1px solid var(--color-border);
      border-radius: 0 4px 4px 0;
      background: var(--color-button-bg-secondary, #f1f5f9);
      color: var(--color-text-secondary);
      font-size: 10px;
      line-height: 1.1;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--color-hover);
      }
    }

    .rolling-placeholder {
      position: absolute;
      left: 0.5em;
      right: calc(var(--search-toggle-w) + 0.4em);
      top: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      overflow: hidden;
      color: var(--color-text-muted);
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    .search-submit {
      flex-shrink: 0;
      background: transparent;
      color: var(--color-text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 1.86em;
      width: 1.86em;
      padding: 0;
      margin: 0;
      border-radius: var(--radius-sm, 6px);
      vertical-align: middle;

      &:hover {
        background: var(--color-hover);
        color: var(--accent);
      }
    }
  }
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
  background: var(--color-nav-bg);
  color: var(--color-text);

  .links {
    a:hover,
    .router-link-active {
      background: var(--accent);
    }

    a:link,
    a:visited {
      color: var(--color-text-secondary);
    }

    .notice-num {
      background: var(--color-unread);
    }
  }

  .search {
    height: auto;

    input {
      background: var(--color-card);
      border-color: var(--color-border);
      color: var(--color-text);
    }

    .rolling-placeholder {
      color: var(--color-text-muted);
    }

    input::placeholder {
      color: var(--color-text-muted);
    }

    .search-submit {
      overflow: hidden;
    }

    .search-mode-toggle--in-field {
      background: var(--color-button-bg-secondary);
      border-left-color: var(--color-border);
      color: var(--color-text-secondary);
    }
  }
}

.lesson {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0ea5e9;
  border-radius: var(--radius-sm, 6px);
  transition: background 0.15s;

  &:hover {
    background: rgba(14, 165, 233, 0.1);
  }
}

.lesson--xiaoqiu {
  color: #0ea5e9;
}

body.dark-mode .lesson {
  color: #38bdf8;
}

body.dark-mode .lesson--xiaoqiu {
  color: #38bdf8;
}
</style>
