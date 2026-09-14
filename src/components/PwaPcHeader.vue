<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHeaderSearch } from '@/composables/useHeaderSearch'
import { useUserStore } from '@/store/userStore'

const props = defineProps<{
  unreadNoticeNum: number
  unreadChatNum: number
  menuOpen?: boolean
}>()

const emit = defineEmits<{
  'update:menuOpen': [value: boolean]
}>()

const router = useRouter()
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
const defaultAvatar = `${import.meta.env.BASE_URL}default-avatar.svg`
const headerAvatarSrc = ref(defaultAvatar)

watch(
  () => userInfo.avatarURL,
  (u) => {
    headerAvatarSrc.value = (u && u.trim()) ? u : defaultAvatar
  },
  { immediate: true },
)

function onHeaderAvatarError() {
  if (headerAvatarSrc.value !== defaultAvatar)
    headerAvatarSrc.value = defaultAvatar
}

const isMenuOpen = computed({
  get: () => props.menuOpen ?? true,
  set: (value: boolean) => emit('update:menuOpen', value),
})

// 检查是否可以返回上一页
// 使用performance.navigation或performance.getEntriesByType来检测
const canGoBack = computed(() => {
  // 如果当前路径不是根路径，通常可以返回
  const currentPath = router.currentRoute.value.path
  if (currentPath !== '/') {
    return true
  }
  // 检查是否有历史记录
  return window.history.length > 1
})

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function goBack() {
  if (canGoBack.value) {
    router.back()
  }
}
</script>

<template>
  <!-- PWA模式下的常驻侧边栏菜单 -->
  <div class="pwa-sidebar" :class="{ collapsed: !isMenuOpen }">
    <div class="sidebar-header" />
    <div class="sidebar-links">
      <router-link to="/" :class="{ 'router-link-active': router.currentRoute.value.name === 'Home' }" active-class="">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=59809&format=png&color=000000);" />
        <span>首页</span>
      </router-link>
      <router-link to="/post">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=89802&format=png&color=000000); background-size: 90% 90%;" />
        <span>发帖</span>
      </router-link>
      <router-link to="/partitions">
        <div class="icon" style="background-image: url(https://sse-market-source-1320172928.cos.ap-guangzhou.myqcloud.com/src/images/uploads/1729566876258317319_icons8-top-wide-sidebar-followed-by-partition-at-bottom-24.png); background-size: 80% 80%;" />
        <span>分区</span>
      </router-link>
      <router-link to="/course">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=85872&format=png&color=000000); background-size: 95% 95%;" />
        <span>课程专区</span>
      </router-link>
      <router-link to="/feedback">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=85500&format=png&color=000000);" />
        <span>反馈</span>
      </router-link>
      <router-link to="/shop">
        <div class="icon" style="background-image: url(https://img.icons8.com/ios-filled/100/shopping-bag.png);" />
        <span>闲置</span>
      </router-link>
      <router-link to="/music">
        <div class="icon" style="background-image: url(https://img.icons8.com/ios-filled/100/music.png);" />
        <span>音乐</span>
      </router-link>
      <router-link to="/rating">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=60985&format=png&color=000000);" />
        <span>打分</span>
      </router-link>
      <router-link to="/smart-xiaoqiu">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=59695&format=png&color=000000); background-size: 90% 90%;" />
        <span>小秋</span>
      </router-link>
      <div class="sidebar-divider" />
      <router-link to="/save">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=85185&format=png&color=000000);" />
        <span>收藏</span>
      </router-link>
      <router-link to="/history">
        <div class="icon" style="background-image: url(https://img.icons8.com/?size=100&id=83976&format=png&color=000000); background-size: 90% 90%;" />
        <span>历史</span>
      </router-link>
      <router-link to="/messages">
        <div class="icon-wrapper">
          <Icon icon="tabler:messages" class="sidebar-messages-icon" width="22" height="22" aria-hidden="true" />
          <div v-if="unreadNoticeNum + unreadChatNum > 0" class="notice-num">
            {{ unreadNoticeNum + unreadChatNum > 99 ? '99+' : unreadNoticeNum + unreadChatNum }}
          </div>
        </div>
        <span>消息</span>
      </router-link>
      <div class="sidebar-bottom">
        <router-link to="/resume" class="sidebar-link-resume">
          <Icon icon="tabler:file-cv" class="sidebar-resume-icon" width="22" height="22" aria-hidden="true" />
          <span>简历专区</span>
        </router-link>
        <router-link to="/options">
          <div class="user-avatar-icon">
            <img :src="headerAvatarSrc" alt="avatar" @error="onHeaderAvatarError">
          </div>
          <span>{{ userInfo.name }}</span>
        </router-link>
      </div>
    </div>
  </div>

  <!-- PWA模式下的搜索Header -->
  <div class="site-header pwa-header" :class="{ 'menu-collapsed': !isMenuOpen }">
    <button type="button" class="menu-button" @click="toggleMenu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
    <button type="button" class="back-button" :disabled="!canGoBack" @click="goBack">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div class="search-container">
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
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* PWA模式样式 */
.pwa-sidebar {
  position: fixed;
  top: var(--pc-header-total, calc(2.75rem + 3em));
  left: 0;
  width: 280px;
  height: calc(100vh - var(--pc-header-total, calc(2.75rem + 3em)));
  background: #ffffffa0;
  backdrop-filter: blur(10px);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
  z-index: 1998;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

@supports not (
  (
    backdrop-filter: blur(1px),
  )
) {
  .pwa-sidebar,
  .site-header.pwa-header {
    background: var(--color-card, #fff);
  }
}

.pwa-sidebar.collapsed {
  transform: translateX(-100%);
}

.site-header.pwa-header {
  display: flex;
  background: #ffffffa0;
  backdrop-filter: blur(10px);
  min-height: var(--layout-nav-h, 2.125rem);
  height: var(--layout-nav-h, 2.125rem);
  color: #444;
  align-items: center;
  padding: 0 0.65em;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
  width: 100%;
  justify-content: flex-start;
  gap: 0.5em;
  position: relative;
  z-index: 1999;
}

.site-header.pwa-header .search-container {
  display: flex;
  align-items: center;
  flex: 1;
  margin-left: 280px;
  transition: margin-left 0.3s ease;
  justify-content: center;
}

.site-header.pwa-header.menu-collapsed .search-container {
  margin-left: 0;
}

.menu-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
  color: #444;
  flex-shrink: 0;
}

.menu-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.back-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
  color: #444;
  flex-shrink: 0;
}

.back-button:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
}

.back-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.site-header.pwa-header .search-container .search {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.45em;
  margin: 0 1em;
  text-align: center;
  max-width: 48em;
}

.site-header.pwa-header .search .search-input-wrap {
  --search-toggle-w: 4.6em;
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 48em;
  height: 1.86em;
  position: relative;
}

.site-header.pwa-header .search .search-input,
.site-header.pwa-header .search input {
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

.site-header.pwa-header .search .search-mode-toggle--in-field {
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

.site-header.pwa-header .search .rolling-placeholder {
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

.site-header.pwa-header .search button[type='submit'] {
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

.site-header.pwa-header .search .search-mode-toggle--in-field:hover {
  background: #ebebeb;
}

.sidebar-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1em;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1.2em;
  color: #444;
}

.sidebar-links {
  flex: 1;
  padding: 0.5em 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.sidebar-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
}

.sidebar-messages-icon {
  flex-shrink: 0;
  color: #2563eb;
}

body.dark-mode .sidebar-messages-icon {
  color: #60a5fa;
}

.sidebar-resume-icon {
  flex-shrink: 0;
  color: #0d9488;
}

body.dark-mode .sidebar-resume-icon {
  color: #2dd4bf;
}

.sidebar-links a {
  display: flex;
  align-items: center;
  padding: 0.75em 1.5em;
  text-decoration: none;
  color: #444;
  transition: background-color 0.2s;
  position: relative;
  gap: 0.75em;
}

.sidebar-links a:hover {
  background: rgba(0, 0, 0, 0.1);
}

.sidebar-links a.router-link-active:not([active-class='']) {
  background: rgba(0, 0, 0, 0.1);
}

.sidebar-links a .icon-wrapper {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-links a .icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.sidebar-links a .user-avatar-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-links a .user-avatar-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-links a span {
  flex: 1;
}

.sidebar-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
  margin: 0.5em 1.5em;
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
  font-size: 11px;
  padding: 2px 4px;
  z-index: 10;
  min-width: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* 暗色模式 */
.dark-mode .pwa-sidebar {
  background: #000000a0;
  color: #ddd;
}

.dark-mode .site-header.pwa-header {
  background: #000000a0;
  color: #ddd;
}

.dark-mode .menu-button {
  color: #ddd;
}

.dark-mode .menu-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dark-mode .back-button {
  color: #ddd;
}

.dark-mode .back-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.dark-mode .site-header.pwa-header .search input {
  background: #88888880;
  border: 1px solid #ccc;
  color: #ccc;
}

.dark-mode .site-header.pwa-header .search .rolling-placeholder {
  color: #aaa;
}

.dark-mode .site-header.pwa-header .search input::placeholder {
  color: #aaa;
}

.dark-mode .site-header.pwa-header .search .search-mode-toggle--in-field {
  background: #ffffff18;
  border-left-color: #666;
  color: #ddd;
}

.dark-mode .sidebar-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .sidebar-header h3 {
  color: #ddd;
}

.dark-mode .sidebar-links a {
  color: #ddd;
}

.dark-mode .sidebar-links a:hover,
.dark-mode .sidebar-links a.router-link-active {
  background: rgba(255, 255, 255, 0.1);
}

.dark-mode .sidebar-divider {
  background: rgba(255, 255, 255, 0.1);
}

body.dark-mode .icon {
  filter: invert(1);
}
</style>
