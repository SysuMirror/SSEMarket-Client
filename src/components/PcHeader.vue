<script lang="ts" setup>
import { useTemplateRef } from 'vue'
import ModeButton from '@/components/ModeButton.vue'
import { useHeaderSearch } from '@/composables/useHeaderSearch'
import { useUserStore } from '@/store/userStore'

defineProps<{
  unreadNoticeNum: number
  unreadChatNum: number
}>()

const sinfo = useTemplateRef<HTMLInputElement>('sinfo')
const { userInfo } = useUserStore()
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
    <div
      class="links"
    >
      <router-link to="/post">
        <div
          class="icon"
          style="
								background-image: url(https://img.icons8.com/?size=100&id=89802&format=png&color=000000);
								background-size: 90% 90%;
							"
        />
        发帖
      </router-link>
      <router-link to="/partitions">
        <div
          class="icon"
          style="
								background-image: url(https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/src/images/uploads/1729566876258317319_icons8-top-wide-sidebar-followed-by-partition-at-bottom-24.png);
								background-size: 80% 80%;
								background-position: 0px 4px;
							"
        />
        分区
      </router-link>
      <router-link
        to="/course"
      >
        <div
          class="icon"
          style="
								background-image: url(https://img.icons8.com/?size=100&id=85872&format=png&color=000000);
								background-size: 95% 95%;
								background-position: 0px 3px;
							"
        />
        课程专区
      </router-link>
      <router-link to="/feedback">
        <div
          class="icon"
          style="
								background-image: url(https://img.icons8.com/?size=100&id=85500&format=png&color=000000);
								background-position: 0px 3px;
							"
        />
        反馈
      </router-link>
      <router-link to="/shop">
        <div
          class="icon" style="
              background-image: url(https://img.icons8.com/ios-filled/100/shopping-bag.png);
              background-position: 0px 3px;
            "
        />
        商城
      </router-link>
      <router-link to="/music">
        <div
          class="icon" style="
              background-image: url(https://img.icons8.com/ios-filled/100/music.png);
              background-position: 0px 3px;
            "
        />
        音乐
      </router-link>
      <router-link to="/rating">
        <div
          class="icon" style="
              background-image: url(https://img.icons8.com/?size=100&id=60985&format=png&color=000000);
              background-position: 0px 3px;
            "
        />
        打分
      </router-link>
      <router-link to="/smart-xiaoqiu" class="link-xiaoqiu">
        <div
          class="icon"
          style="
              background-image: url(https://img.icons8.com/?size=100&id=59695&format=png&color=000000);
              background-size: 90% 90%;
            "
        />
        小秋
      </router-link>
    </div>
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
    </form>
    <div
      class="links account"
    >
      <RouterLink
        to="/save"
      >
        <div
          class="icon"
          style="
								background-image: url(https://img.icons8.com/?size=100&id=85185&format=png&color=000000);
							"
        />
        收藏
      </RouterLink>
      <RouterLink
        to="/history"
      >
        <div
          class="icon"
          style="
								background-image: url(https://img.icons8.com/?size=100&id=83976&format=png&color=000000);
								background-size: 90% 90%;
							"
        />
        历史
      </RouterLink>
      <router-link to="/messages">
        <div
          class="icon"
          style="
								background-image: url(https://img.icons8.com/?size=100&id=83142&format=png&color=000000);
							"
        />
        消息
        <div
          v-if="unreadNoticeNum + unreadChatNum > 0"
          class="notice-num"
        >
          {{ unreadNoticeNum + unreadChatNum > 99 ? '99+' : unreadNoticeNum + unreadChatNum }}
        </div>
      </router-link>
      <router-link to="/options">
        {{ userInfo.name }}
      </router-link>
      <ModeButton class="pc-mode-toggle" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.site-header {
  display: flex;
  background: #ffffffa0;
  backdrop-filter: blur(2px);
  min-height: var(--layout-nav-h, 2.125rem);
  height: var(--layout-nav-h, 2.125rem);
  color: #444;
  align-items: center;
  padding: 0 0.65em;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.3s ease;
  margin-bottom: 0px;
  overflow: hidden;
  transition: height 0.3s ease;

  .pc-mode-toggle {
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    margin-left: 0.45em;
    padding: 0 0.25em;
    color: #444;
  }

  .links {
    a {
      position: relative;
      display: inline-block;
      padding: 0.12em 0.38em;
      font-size: 13px;
      border-radius: 4px;
      margin-right: 0.2em;
      text-decoration: none;
      transition: all 0.2s;
    }

    a:hover,
    .router-link-active {
      background: #444;
      color: #fff !important;

      .icon {
        filter: invert(1);
      }
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
    gap: 0.45em;
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
      border: 1px solid #ccc;
      border-radius: 5px;
      line-height: 0.8;
      vertical-align: middle;
      box-sizing: border-box;
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
      border-left: 1px solid #d7d7d7;
      border-radius: 0 4px 4px 0;
      background: #f3f3f3;
      color: #555;
      font-size: 10px;
      line-height: 1.1;
      white-space: nowrap;
      cursor: pointer;
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
      color: #777;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    button[type='submit'] {
      flex-shrink: 0;
      background: unset;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 1.86em;
      width: 1.86em;
      padding: 0;
      margin: 0;
      vertical-align: middle;
    }

    .search-mode-toggle--in-field:hover {
      background: #ebebeb;
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

    .rolling-placeholder {
      color: #aaa;
    }

    input::placeholder {
      color: #aaa;
    }
    button[type='submit'] {
      overflow: hidden;
    }

    .search-mode-toggle--in-field {
      background: #ffffff18;
      border-left-color: #666;
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
</style>
