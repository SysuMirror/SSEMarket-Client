<script lang="ts" setup>
import { computed, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { useHeaderSearch } from '@/composables/useHeaderSearch'

const route = useRoute()
const sinfo = useTemplateRef<HTMLInputElement>('sinfo')
const { search, searchModeButtonText, searchPlaceholder, toggleSearchMode } = useHeaderSearch(sinfo)

const shopSidebarIsShow = computed(() => {
  return /^\/(?:myproducts|shop)/.test(route.fullPath)
})
</script>

<template>
  <div v-if="!shopSidebarIsShow" class="site-header">
    <RouterLink
      to="/course"
      class="lesson"
      style="
              background-image: url(https://img.icons8.com/?size=100&id=kmUrp7YjifpP&format=png&color=000000);
            "
    />
    <form class="search" @submit.prevent="search">
      <input
        id="sinfo"
        ref="sinfo"
        name="sinfo"
        :placeholder="searchPlaceholder"
      >
      <button type="submit">
        <div
          class="icon"
          style="
                  background-image: url(https://img.icons8.com/?size=100&id=131&format=png&color=000000);
                  background-size: 75% 75%;
                  background-position: 0px 0px;
                "
        />
      </button>
      <button class="search-mode-toggle" type="button" @click="toggleSearchMode">
        {{ searchModeButtonText }}
      </button>
    </form>
    <router-link
      to="/post"
      class="icon bright-icon post-button"
      style="
              width: 26px;
              height: 26px;
              background-position: 1px -1px;
              background-image: url(https://ssemarket.cn/new/webp/sendPostButton.webp)
            "
    />
  </div>
</template>

<style lang="scss" scoped>
.site-header {
  display: flex;
  flex-shrink: 0;
  min-height: var(--layout-nav-h, 2.125rem);
  height: var(--layout-nav-h, 2.125rem);
  background: #ffffffa0;
  backdrop-filter: blur(2px);
  color: #444;
  align-items: center;
  padding: 0 0.45em;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
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
      transition: all 0.2s;
    }

    a:hover,
    .router-link-active {
      background: #444;
      color: #fff !important;
    }

    a:link,
    a:visited {
      color: #444;
    }

    .notice-num {
      position: absolute;
      top: -4px;
      right: -3px;
      border-radius: 9px;
      background: #ff5050;
      color: #eee;
      height: 1rem;
      text-align: center;
      line-height: 1;
      font-size: 13px;
      padding: 2px 4px;
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

    input {
      flex: 1;
      min-width: 0;
      width: 100%;
      max-width: 48em;
      height: 1.55em;
      padding: 0 1.6em 0 0.5em;
      font-size: 12px;
      border: 1px solid #ccc;
      border-radius: 5px;
      line-height: 0.8;
      vertical-align: middle;
    }

    button[type='submit'] {
      flex-shrink: 0;
      background: unset;
      height: 1em;
      width: 1em;
      padding: 0;
      margin: 0 0 0 -1.5em;
      vertical-align: middle;
    }

    .search-mode-toggle {
      flex-shrink: 0;
      width: auto;
      height: 1.55em;
      margin: 0;
      padding: 0 0.5em;
      border: 1px solid #d7d7d7;
      border-radius: 5px;
      background: #f7f7f7;
      color: #555;
      font-size: 11px;
      line-height: 1;
      white-space: nowrap;
    }

  }
}
.dark-mode .site-header {
  background: #000000a0;
  color: #ddd;

  .links {
    a:hover,
    .router-link-active {
      background: #66666680;
    }

    a:link,
    a:visited {
      color: #ddd;
    }

    .notice-num {
      background: #ff5050;
    }
  }

  .search {
    height: 30px;

    input {
      background: #88888880;
      border: 1px solid #ccc;
      color: #ccc;
    }

    input::placeholder {
      color: #aaa;
    }
    button[type='submit'] {
      overflow: hidden;
    }

    .search-mode-toggle {
      background: #ffffff12;
      border-color: #777;
      color: #ddd;
    }

  }
}

.icon {
  width: 20px;
  height: 20px;
  background-size: cover;
  background-repeat: no-repeat;
  background-size: contain;
  background-position: 0px 3px;
  display: inline-block;
}

body.dark-mode .icon {
  filter: invert(1);
}

/* 课程专区（暂时） */
.lesson {
  width: 26px;
  height: 26px;
  background-size: cover;
  background-repeat: no-repeat;
  background-size: contain;
  background-position: 0px 3px;
  display: inline-block;
}

body.dark-mode .lesson {
  filter: brightness(1.1) saturate(1.2) drop-shadow(0 0 6px rgba(150, 200, 255, 0.4))
    drop-shadow(0 0 10px rgba(150, 200, 255, 0.2));
}

.bright-icon {
  display: block;
  width: 26px;
  height: 26px;
  text-align: center;
  margin: 5px;
  background-size: 100%;
  background-repeat: no-repeat;
}
body.dark-mode .bright-icon {
  filter: invert(1) brightness(1.4) saturate(1.2) drop-shadow(0 0 6px rgba(150, 200, 255, 0.4))
    drop-shadow(0 0 10px rgba(150, 200, 255, 0.2));
}
.post-button {
  color: #444;
  font-weight: bold;
}
</style>
