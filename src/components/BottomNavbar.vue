<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { handleHomeNavClick } from '@/utils/scrollHome'

const { noticeNum = 0, chatNum = 0 } = defineProps<{
  noticeNum?: number
  chatNum?: number
}>()

const route = useRoute()
const path = computed(() => route.path)

const isHome = computed(() => path.value === '/' || path.value === '/partition' || path.value.startsWith('/partition/'))
const isMessages = computed(() =>
  path.value === '/messages' || path.value === '/notice' || path.value === '/chat',
)
const totalMessageNum = computed(() => (noticeNum || 0) + (chatNum || 0))
const isWorkbench = computed(() => path.value === '/workbench')
const isPost = computed(() => path.value === '/post')
const myRoutes = ['/options', '/save', '/history', '/feedback']
const isMySection = computed(() => myRoutes.some(p => path.value === p || path.value.startsWith(`${p}/`)))

const myMenuVisible = ref(false)
let navResizeObserver: ResizeObserver | undefined

function syncLayoutBottomNavHeight() {
  const nav = document.getElementById('bottomNavBar')
  if (!nav || nav.offsetHeight === 0)
    return

  document.documentElement.style.setProperty('--layout-bottom-nav-h', `${nav.offsetHeight}px`)
}

function toggleMyMenu() {
  myMenuVisible.value = !myMenuVisible.value
}

function closeMyMenu() {
  myMenuVisible.value = false
}

function onHomeNavClick(e: MouseEvent) {
  closeMyMenu()
  handleHomeNavClick(e, route)
}

function onDocClick(e: MouseEvent) {
  const el = e.target as Node
  const root = document.getElementById('bottomNavBar')
  if (myMenuVisible.value && root && !root.contains(el))
    myMenuVisible.value = false
}

watch(() => route.path, () => {
  myMenuVisible.value = false
})

onMounted(() => {
  document.addEventListener('click', onDocClick)
  nextTick(() => {
    const nav = document.getElementById('bottomNavBar')
    if (!nav)
      return

    syncLayoutBottomNavHeight()
    navResizeObserver = new ResizeObserver(syncLayoutBottomNavHeight)
    navResizeObserver.observe(nav)
  })
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  navResizeObserver?.disconnect()
  navResizeObserver = undefined
})
</script>

<template>
  <nav
    id="bottomNavBar"
    class="bottom-nav"
    role="navigation"
    aria-label="主导航"
  >
    <div class="bottom-nav__inner">
      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isHome }"
        to="/"
        @click="onHomeNavClick"
      >
        <Icon icon="tabler:home" class="bottom-nav__icon bottom-nav__icon--home" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">主页</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--badge-wrap"
        :class="{ 'bottom-nav__item--active': isMessages }"
        to="/messages"
        @click="closeMyMenu"
      >
        <span class="bottom-nav__icon-slot">
          <span v-if="totalMessageNum > 0" class="bottom-nav__badge">{{ totalMessageNum > 99 ? '99+' : totalMessageNum }}</span>
          <Icon icon="tabler:messages" class="bottom-nav__icon bottom-nav__icon--messages" width="24" height="24" aria-hidden="true" />
        </span>
        <span class="bottom-nav__text">消息</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--post"
        :class="{ 'bottom-nav__item--active': isPost }"
        to="/post"
        aria-label="发帖"
        @click="closeMyMenu"
      >
        <span class="bottom-nav__post-btn">
          <Icon icon="tabler:plus" width="26" height="26" aria-hidden="true" />
        </span>
        <span class="bottom-nav__text">发帖</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isWorkbench }"
        to="/workbench"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:grid-dots" class="bottom-nav__icon bottom-nav__icon--workbench" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">工作台</span>
      </RouterLink>

      <div class="bottom-nav__item bottom-nav__item--my" :class="{ 'bottom-nav__item--active': isMySection }">
        <button
          type="button"
          class="bottom-nav__my-trigger"
          :aria-expanded="myMenuVisible"
          aria-haspopup="true"
          aria-label="我的菜单"
          @click.stop="toggleMyMenu"
        >
          <Icon icon="tabler:user" class="bottom-nav__icon bottom-nav__icon--user" width="24" height="24" aria-hidden="true" />
          <span class="bottom-nav__text">我的</span>
        </button>
        <Transition name="bottom-nav-drop">
          <div v-show="myMenuVisible" class="bottom-nav__dropdown" role="menu">
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/options" @click="closeMyMenu">
              个人信息
            </RouterLink>
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/save" @click="closeMyMenu">
              我的收藏
            </RouterLink>
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/history" @click="closeMyMenu">
              发帖历史
            </RouterLink>
            <RouterLink class="bottom-nav__drop-link" role="menuitem" to="/feedback" @click="closeMyMenu">
              反馈
            </RouterLink>
          </div>
        </Transition>
      </div>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  padding: 0;
  pointer-events: none;
}

.bottom-nav__inner {
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
  background: var(--color-nav-bg, var(--chat-bg-highlight));
  border: none;
  border-top: 1px solid var(--color-border, var(--chat-border));
  border-radius: 0;
  box-shadow: 0 -2px 12px rgba(71, 85, 105, 0.06);
}

.bottom-nav__item {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: 14px;
  text-decoration: none;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  .bottom-nav__text {
    color: var(--chat-text-secondary);
    transition:
      color 0.18s ease,
      font-weight 0.18s ease;
  }

  &:not(.bottom-nav__item--my):hover {
    background: var(--accent-soft, rgba(44, 61, 86, 0.06));
    box-shadow: none;

    .bottom-nav__text {
      color: var(--chat-text);
      font-weight: 600;
    }
  }

  &--active:not(.bottom-nav__item--my) {
    background: transparent;
    box-shadow: none;

    .bottom-nav__icon {
      color: var(--accent, var(--chat-accent));
    }

    .bottom-nav__text {
      color: var(--accent, var(--chat-accent));
      font-weight: 700;
    }
  }

  &--badge-wrap {
    position: relative;
  }

  &--post {
    position: relative;
    flex: 1;
    overflow: visible;
  }

  &--my {
    flex: 1;
    padding: 0;
  }
}

.bottom-nav__my-trigger {
  width: 100%;
  height: 100%;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 2px;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  .bottom-nav__text {
    color: var(--chat-text-secondary);
    transition:
      color 0.18s ease,
      font-weight 0.18s ease;
  }

  &:hover {
    background: var(--accent-soft, rgba(44, 61, 86, 0.06));
    box-shadow: none;

    .bottom-nav__text {
      color: var(--chat-text);
      font-weight: 600;
    }
  }
}

.bottom-nav__item--active.bottom-nav__item--my .bottom-nav__my-trigger {
  background: transparent;
  box-shadow: none;

  .bottom-nav__icon {
    color: var(--accent, var(--chat-accent));
  }

  .bottom-nav__text {
    color: var(--accent, var(--chat-accent));
    font-weight: 700;
  }
}

.bottom-nav__icon {
  flex-shrink: 0;
  opacity: 0.8;
  color: var(--color-text-secondary, var(--chat-text-secondary));
  transition:
    color 0.18s ease,
    opacity 0.18s ease;
}

/* 中间凸起发帖按钮：藏青底色 + 白色加号，垂直突出于导航条 */
.bottom-nav__post-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  margin-top: -16px;
  border-radius: 50%;
  color: var(--color-to-post, #fff);
  background: var(--accent, var(--chat-accent));
  box-shadow:
    0 4px 12px rgba(44, 61, 86, 0.3),
    0 0 0 3px var(--color-card, var(--chat-bg-highlight));
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.bottom-nav__item--post:hover .bottom-nav__post-btn {
  transform: translateY(-2px);
  box-shadow:
    0 6px 16px rgba(44, 61, 86, 0.4),
    0 0 0 3px var(--color-card, var(--chat-bg-highlight));
}

.bottom-nav__item--post:active .bottom-nav__post-btn {
  transform: translateY(0);
}

.bottom-nav__item--post.bottom-nav__item--active .bottom-nav__post-btn {
  background: var(--accent-hover, var(--chat-accent));
}

body.dark-mode .bottom-nav__post-btn {
  color: var(--color-to-post);
  background: var(--accent);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 0 0 3px var(--color-card);
}

body.dark-mode .bottom-nav__item:not(.bottom-nav__item--my):hover {
  background: var(--accent-soft);
  box-shadow: none;

  .bottom-nav__text {
    color: var(--chat-text);
  }
}

body.dark-mode .bottom-nav__item--active:not(.bottom-nav__item--my) {
  background: transparent;
  box-shadow: none;

  .bottom-nav__icon {
    color: var(--accent);
  }

  .bottom-nav__text {
    color: var(--accent);
  }
}

body.dark-mode .bottom-nav__my-trigger:hover {
  background: var(--accent-soft);
  box-shadow: none;

  .bottom-nav__text {
    color: var(--chat-text);
  }
}

body.dark-mode .bottom-nav__item--active.bottom-nav__item--my .bottom-nav__my-trigger {
  background: transparent;
  box-shadow: none;

  .bottom-nav__icon {
    color: var(--accent);
  }

  .bottom-nav__text {
    color: var(--accent);
  }
}

.bottom-nav__text {
  white-space: nowrap;
}

.bottom-nav__icon-slot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bottom-nav__badge {
  position: absolute;
  top: -7px;
  right: -9px;
  z-index: 2;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: var(--color-unread-text, #fff);
  background: var(--color-unread, #ef4444);
  border-radius: 999px;
  box-shadow: 0 0 0 2px var(--color-card, var(--chat-bg-highlight));
}

.bottom-nav__dropdown {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  left: auto;
  min-width: 148px;
  padding: 6px;
  background: var(--color-card, var(--chat-bg-highlight));
  border: 1px solid var(--color-border, var(--chat-border));
  border-radius: var(--radius-lg, 14px);
  box-shadow: var(--color-card-hover-shadow, 0 8px 28px rgba(71, 85, 105, 0.12));
}

.bottom-nav__drop-link {
  display: block;
  padding: 10px 12px;
  border-radius: var(--radius-md, 8px);
  text-align: left;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--chat-text);
  transition: background 0.12s ease;

  &:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  &.router-link-active {
    color: var(--accent, var(--chat-accent));
    background: var(--accent-soft);
  }
}

body.dark-mode .bottom-nav__drop-link:hover {
  background: var(--color-hover);
}

body.dark-mode .bottom-nav__drop-link.router-link-active {
  color: var(--accent);
  background: var(--accent-soft);
}

.bottom-nav-drop-enter-active,
.bottom-nav-drop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.bottom-nav-drop-enter-from,
.bottom-nav-drop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media screen and (min-width: 768px) {
  .bottom-nav {
    position: relative;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .bottom-nav__inner {
    max-width: 640px;
  }
}
</style>
